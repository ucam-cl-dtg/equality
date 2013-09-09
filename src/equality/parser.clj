(ns equality.parser
  (:use [clojure.pprint]
        [equality.printing])
  (:require [equality.geometry :as geom]))


(derive :type/num :type/expr)
(derive :type/var :type/expr)
(derive :type/add :type/expr)
(derive :type/sub :type/expr)
(derive :type/mult :type/expr)
(derive :type/frac :type/expr)
(derive :type/pow :type/expr)
;; NOTE: :type/eq is not an expr!

(defn precedence [type]
  (case type
    :type/symbol 999
    :type/num 999
    :type/var 999
    :type/add 5
    :type/sub 5
    :type/mult 10
    :type/eq 1
    :type/frac 15
    :type/pow 20))

(defmulti symbols :type)

(defmethod symbols :type/symbol [expr]
  [expr])

(defmethod symbols :type/num [expr]
  [expr])

(defmethod symbols :type/var [expr]
  [expr])

(defmethod symbols :type/add [expr]
  (concat [expr] (symbols (:left-op expr)) (symbols (:right-op expr))))

(defmethod symbols :type/sub [expr]
  (concat [expr] (symbols (:left-op expr)) (symbols (:right-op expr))))

(defmethod symbols :type/mult [expr]
  (concat (symbols (:left-op expr)) (symbols (:right-op expr)) (when (:id expr) [expr])))

(defmethod symbols :type/eq [expr]
  (concat [expr] (symbols (:left-op expr)) (symbols (:right-op expr))))

(defmethod symbols :type/frac [expr]
  (concat [expr] (symbols (:numerator expr)) (symbols (:denominator expr))))

(defmethod symbols :type/pow [expr]
  (concat (symbols (:base expr)) (symbols (:exponent expr))))

(defn numeric? [str]
  (try
    (Float/parseFloat str)
    (catch Exception e
      false)))

(defn binary-op-rule [token type]
  (fn [input]
    (let [tokens (filter #(and (isa? (:type %) :type/symbol)
                               (= (:token %) token)) input)]
      (apply concat
             (for [t tokens
                   :let [remaining-input (disj input t)
                         potential-left-ops (filter #(and (geom/boxes-intersect? (geom/left-box t (* 2 (:width t)) (* 0.3 (:height t))) %)
                                                          (< (geom/bbox-right %) (:x (geom/bbox-middle t)))
                                                          (< (geom/bbox-right %) (+ (:left t) (* 0.5 (:width %))))
                                                          (isa? (:type %) :type/expr)
                                                          (> (precedence (:type %)) (precedence type))) remaining-input)
                         potential-right-ops (filter #(and (geom/boxes-intersect? (geom/right-box t (* 2 (:width t)) (* 0.3 (:height t))) %)
                                                           (> (:left %) (:x (geom/bbox-middle t)))
                                                           (> (:left %) (- (geom/bbox-right t) (* 0.5 (:width %))))
                                                           (isa? (:type %) :type/expr)
                                                           (>= (precedence (:type %)) (precedence type))) remaining-input)]
                   :when (and (not-empty potential-left-ops)
                              (not-empty potential-right-ops))]
               (for [left potential-left-ops
                     right potential-right-ops
                     :let [remaining-input (disj remaining-input left right)]]
                 (conj remaining-input (merge {:id (:id t)
                                               :type type
                                               :left-op left
                                               :right-op right
                                               :symbol-count (+ 1
                                                                (:symbol-count left)
                                                                (:symbol-count right))}
                                              (geom/bbox-combine left right t)))))))))

(def non-var-symbols #{"+" "-" "="})

(def rules
  {"num" {:apply (fn [input]
                   ;; This rule is unusual - it replaces all number symbols with :type/num expressions. No need to do one at a time.
                   (let [rtn (set (map (fn [potential-num]
                                         (if (and (isa? (:type potential-num) :type/symbol)
                                                  (numeric? (:token potential-num)))
                                           ;; Replace
                                           (merge potential-num {:type :type/num
                                                                 :symbol-count 1})
                                           ;; Do not replace
                                           potential-num)) input))]
                     (if (= rtn (set input))
                       []
                       [rtn])))}
   "var" {:apply (fn [input]
                   ;; This rule is unusual - it replaces all var symbols with :type/var expressions. No need to do one at a time.
                   (let [rtn (set (map (fn [potential-var]
                                         (if (and (isa? (:type potential-var) :type/symbol)
                                                  (not (numeric? (:token potential-var)))
                                                  (string? (:token potential-var))
                                                  (= (count (:token potential-var)) 1)
                                                  (not (contains? non-var-symbols (:token potential-var))))
                                           ;; Replace
                                           (merge potential-var {:type :type/var
                                                                 :symbol-count 1})
                                           ;; Do not replace
                                           potential-var)) input))]
                     (if (= rtn (set input))
                       []
                       [rtn])))}
   "power" {:apply (fn [input]
                     (let [potential-bases (filter #(and (isa? (:type %) :type/expr)
                                                         (> (precedence (:type %)) (precedence :type/pow))) input)]
                       (apply concat
                              (for [b potential-bases
                                    :let [remaining-input (disj input b)
                                          potential-exponents (filter #(and (geom/line-intersects-box? {:x (geom/bbox-right b) :dx (:width b)
                                                                                                        :y (:top b) :dy (- (:width b))} %)
                                                                            (> (:left %) (+ (:left b) (* 0.5 (:width b))))
                                                                            (< (+ (:top %) (:height %)) (+ (:top b) (* 0.5 (:height b))))
                                                                            (isa? (:type %) :type/expr)) remaining-input)]
                                    :when (not-empty potential-exponents)]
                                (for [e potential-exponents
                                      :let [remaining-input (disj remaining-input e)]]
                                  (conj remaining-input (merge {:type :type/pow
                                                                :base b
                                                                :exponent e
                                                                :symbol-count (+ (:symbol-count b)
                                                                                 (:symbol-count e))}
                                                               (geom/bbox-combine b e))))))))}
   "adjacent-mult" {:apply (fn [input]
                             (let [potential-left-ops (filter #(and (isa? (:type %) :type/expr)
                                                                    (> (precedence (:type %)) (precedence :type/mult))) input)]
                               (apply concat
                                      (for [left potential-left-ops
                                            :let [db false ;;(= (expr-str left) "((3y)) / (4)")
                                                  _ (when db
                                                      (println "TESTING 3y/4!"))
                                                  remaining-input (disj input left)
                                                  _ (when db
                                                      (println "Remaining:" remaining-input)
                                                      (println "Right box:" (geom/right-box left (* 2 (:width left)) (* 0.3 (:height left)))))
                                                  potential-right-ops (filter #(and (do (when db (println "e: " %)) true)
                                                                                    (geom/boxes-intersect? (geom/right-box left (* 2 (:width left)) (* 0.3 (:height left))) %)

                                                                                    (> (:left %) (- (geom/bbox-right left) (* 0.5 (:width %))))
                                                                                    (> (:left %) (:x (geom/bbox-middle left)))
                                                                                    (>= (precedence (:type %)) (precedence :type/mult))
                                                                                    (not= (:type %) :type/num)
                                                                                    (if (= (:type %) :type/pow)
                                                                                      (not= (:type (:base %)) :type/num)
                                                                                      true)
                                                                                    (if (= (:type %) :type/mult)
                                                                                      (not= (:type (:left-op %)) :type/num)
                                                                                      true)
                                                                                    (isa? (:type %) :type/expr)) remaining-input)
                                                  _ (when db
                                                      (println potential-right-ops)
                                                      (println "***"))]
                                            :when (not-empty potential-right-ops)]
                                        (for [right potential-right-ops
                                              :let [remaining-input (disj remaining-input right)]]
                                          (conj remaining-input (merge {:type :type/mult
                                                                        :left-op left
                                                                        :right-op right
                                                                        :symbol-count (+ (:symbol-count left)
                                                                                         (:symbol-count right))}
                                                                       (geom/bbox-combine left right))))))))}
   "addition" {:apply (binary-op-rule "+" :type/add)}
   "subtraction" {:apply (binary-op-rule "-" :type/sub)}
   "equals" {:apply (binary-op-rule "=" :type/eq)}
   "fraction" {:apply (fn [input]
                        (let [tokens (filter #(and (isa? (:type %) :type/symbol)
                                                   (= (:token %) :frac)) input)]
                          (apply concat
                                 (for [t tokens
                                       :let [remaining-input (disj input t)
                                             potential-numerators (filter #(and (isa? (:type %) :type/expr)
                                                                                (geom/line-intersects-box? {:x (:left t)
                                                                                                            :dx (:width t)
                                                                                                            :y (- (:top t) (:height %))
                                                                                                            :dy 0} %)
                                                                                (> (:left %) (- (:left t) (* 0.1 (:width %))))
                                                                                (< (geom/bbox-right %) (+ (geom/bbox-right t) (* 0.1 (:width %))))) remaining-input)
                                             potential-denominators (filter #(and (isa? (:type %) :type/expr)
                                                                                  (geom/line-intersects-box? {:x (:left t)
                                                                                                              :dx (:width t)
                                                                                                              :y (+ (geom/bbox-bottom t) (:height %))
                                                                                                              :dy 0} %)
                                                                                  (> (:left %) (- (:left t) (* 0.1 (:width %))))
                                                                                  (< (geom/bbox-right %) (+ (geom/bbox-right t) (* 0.1 (:width %))))) remaining-input)]
                                       :when (and (not-empty potential-numerators)
                                                  (not-empty potential-denominators))]
                                   (for [numerator potential-numerators
                                         denominator potential-denominators
                                         :let [remaining-input (disj remaining-input numerator denominator)]]
                                     (conj remaining-input (merge {:id (:id t)
                                                                   :type :type/frac
                                                                   :numerator numerator
                                                                   :denominator denominator
                                                                   :symbol-count (+ 1
                                                                                    (:symbol-count numerator)
                                                                                    (:symbol-count denominator))}
                                                                  (geom/bbox-combine t numerator denominator))))))))}})



(def parse
  ;;(println "********")
  ;;(println "Parsing")
  ;;(pprint input)

  (memoize
   (fn [input rules]

     (cons input
           (distinct (apply concat
                            (for [[k r] rules
                                  :let [new-inputs ((:apply r) input)]
                                  :when (not-empty new-inputs)]
                              (apply concat (for [i new-inputs]
                                              (parse i rules))))))))))
