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

(defn filter-token [ans]
  (let [v {:token (:token ans)}
        v (if (:children ans)
            (assoc v :children (map filter-token (:children ans)))
            v)
        v (if (:match ans)
            (assoc v :match (filter-token (:match ans)))
            v)]
    v))

(defn all-symbols [input]
  (if (:children input)
    [(:token input) (map all-symbols (:children input))]
    [(:token input)]))

(defn bbox-contains [bbox point]
  (and (< (:top bbox) (:y point))
       (< (:left bbox) (:x point))
       (> (+ (:top bbox) (:height bbox)) (:y point))
       (> (+ (:left bbox) (:width bbox)) (:x point))))


(defn east-point [bbox distance]
  {:x (+ (:left bbox) (:width bbox) distance)
   :y (+ (:top bbox) (* 0.5 (:height bbox)))})

(defn west-point [bbox distance]
  {:x (- (:left bbox) distance)
   :y (+ (:top bbox) (* 0.5 (:height bbox)))})


(defn north-point [bbox]
  {:x (+ (:left bbox) (* 0.5 (:width bbox)))
   :y (- (:top bbox) (* 0.5 (:height bbox)))})

(defn south-point [bbox]
  {:x (+ (:left bbox) (* 0.5 (:width bbox)))
   :y (+ (:top bbox) (* 1.5 (:height bbox)))})

(defn north-east-point [bbox distance]
  {:x (+ (:left bbox) (:width bbox) distance)
   :y (- (:top bbox) distance)})

(defn bbox-combine [& bboxes]
  (let [left (apply min (map :left bboxes))
        top (apply min (map :top bboxes))]
    {:left left
     :top top
     :width (- (apply max (map #(+ (:left %) (:width %)) bboxes)) left)
     :height (- (apply max (map #(+ (:top %) (:height %)) bboxes)) top)}))

(defn bbox-right [bbox]
  (+ (:left bbox) (:width bbox)))

(defn bbox-bottom [bbox]
  (+ (:top bbox) (:height bbox)))

(defn bbox-middle [bbox]
  {:x (+ (:left bbox) (* 0.5 (:width bbox)))
   :y (+ (:top bbox) (* 0.5 (:height bbox)))})

(defn left-box [target width height]
  {:left (:left target) :width (- width)
   :top (- (:y (bbox-middle target)) (* 0.5 height)) :height height})

(defn right-box [target width height]
  {:left (bbox-right target) :width width
   :top (- (:y (bbox-middle target)) (* 0.5 height)) :height height})

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
                         potential-left-ops (filter #(and (geom/boxes-intersect? (left-box t (* 2 (:width t)) (* 0.3 (:height t))) %)
                                                          (< (bbox-right %) (:x (bbox-middle t)))
                                                          (< (bbox-right %) (+ (:left t) (* 0.1 (:width %))))
                                                          (isa? (:type %) :type/expr)
                                                          (> (precedence (:type %)) (precedence type))) remaining-input)
                         potential-right-ops (filter #(and (geom/boxes-intersect? (right-box t (* 2 (:width t)) (* 0.3 (:height t))) %)
                                                           (> (:left %) (:x (bbox-middle t)))
                                                           (> (:left %) (- (bbox-right t) (* 0.1 (:width %))))
                                                           (isa? (:type %) :type/expr)
                                                           (>= (precedence (:type %)) (precedence type))) remaining-input)]
                   :when (and (not-empty potential-left-ops)
                              (not-empty potential-right-ops))]
               (for [left potential-left-ops
                     right potential-right-ops
                     :let [remaining-input (disj remaining-input left right)]]
                 (conj remaining-input (merge {:type type
                                               :left-op left
                                               :right-op right}
                                              (bbox-combine left right t)))))))))

(def non-var-symbols #{"+" "-" "="})

(def rules
  {"num" {:apply (fn [input]
                   ;; This rule is unusual - it replaces all number symbols with :type/num expressions. No need to do one at a time.
                   (let [rtn (set (map (fn [potential-num]
                                         (if (and (isa? (:type potential-num) :type/symbol)
                                                  (numeric? (:token potential-num)))
                                           ;; Replace
                                           (merge potential-num {:type :type/num})
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
                                           (merge potential-var {:type :type/var})
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
                                          potential-exponents (filter #(and (geom/line-intersects-box? {:x (bbox-right b) :dx (:width b)
                                                                                                        :y (:top b) :dy (- (:width b))} %)
                                                                            (> (:left %) (+ (:left b) (* 0.5 (:width b))))
                                                                            (< (+ (:top %) (:height %)) (+ (:top b) (* 0.5 (:height b))))
                                                                            (isa? (:type %) :type/expr)) remaining-input)]
                                    :when (not-empty potential-exponents)]
                                (for [e potential-exponents
                                      :let [remaining-input (disj remaining-input e)]]
                                  (conj remaining-input (merge {:type :type/pow
                                                                :base b
                                                                :exponent e}
                                                               (bbox-combine b e))))))))}
   "adjacent-mult" {:apply (fn [input]
                             (let [potential-left-ops (filter #(and (isa? (:type %) :type/expr)
                                                                    (> (precedence (:type %)) (precedence :type/mult))) input)]
                               (apply concat
                                      (for [left potential-left-ops
                                            :let [remaining-input (disj input left)
                                                  potential-right-ops (filter #(and (geom/boxes-intersect? (right-box left (:width left) (* 0.3 (:height left))) %)
                                                                                    (> (:left %) (- (bbox-right left) (* 0.1 (:width %))))
                                                                                    (> (:left %) (:x (bbox-middle left)))
                                                                                    (>= (precedence (:type %)) (precedence :type/mult))
                                                                                    (not= (:type %) :type/num)
                                                                                    (if (= (:type %) :type/pow)
                                                                                      (not= (:type (:base %)) :type/num)
                                                                                      true)
                                                                                    (if (= (:type %) :type/mult)
                                                                                      (not= (:type (:left-op %)) :type/num)
                                                                                      true)
                                                                                    (isa? (:type %) :type/expr)) remaining-input)]
                                            :when (not-empty potential-right-ops)]
                                        (for [right potential-right-ops
                                              :let [remaining-input (disj remaining-input right)]]
                                          (conj remaining-input (merge {:type :type/mult
                                                                        :left-op left
                                                                        :right-op right}
                                                                       (bbox-combine left right))))))))}
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
                                                                                (< (bbox-right %) (+ (bbox-right t) (* 0.1 (:width %))))) remaining-input)
                                             potential-denominators (filter #(and (isa? (:type %) :type/expr)
                                                                                  (geom/line-intersects-box? {:x (:left t)
                                                                                                              :dx (:width t)
                                                                                                              :y (+ (bbox-bottom t) (:height %))
                                                                                                              :dy 0} %)
                                                                                  (> (:left %) (- (:left t) (* 0.1 (:width %))))
                                                                                  (< (bbox-right %) (+ (bbox-right t) (* 0.1 (:width %))))
                                                                                  #_(bbox-contains % {:x (+ (:left t) (* 0.5 (:width t)))
                                                                                                    :y (+ (:top t) (:height t) (* 0.5 (:height %)))})
                                                                                  #_(> (:top %) (+ (:top t) (:height t)))) remaining-input)]
                                       :when (and (not-empty potential-numerators)
                                                  (not-empty potential-denominators))]
                                   (for [numerator potential-numerators
                                         denominator potential-denominators
                                         :let [remaining-input (disj remaining-input numerator denominator)]]
                                     (conj remaining-input (merge {:type :type/frac
                                                                   :numerator numerator
                                                                   :denominator denominator}
                                                                  (bbox-combine t numerator denominator))))))))}})



(defn parse [input rules]
  ;;(println "********")
  ;;(println "Parsing")
  ;;(pprint input)
  (if (and (= (count input) 1)
           (not= (:type (first input)) :type/symbol))
    [(first input)]
    (distinct (apply concat
                     (for [[k r] rules
                           :let [new-inputs ((:apply r) input)]
                           :when (not-empty new-inputs)]
                       (apply concat (for [i new-inputs]
                                       (parse i rules))))))))
