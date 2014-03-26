(ns equality.parser
  (:use [equality.printing :only [print-expr mathml]])
  (:require [equality.geometry :as geom]
            [clojure.set]))

(set! cljs.core/*print-newline* false)

(set! cljs.core/*print-fn*
      (fn [& args]
        (.apply js/console.log js/console (into-array args))))


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
  (not (js/isNaN (js/parseFloat str))))

(defn binary-op-rule [token type]
  (fn [input]

    ;; Matching operators are those of type :type/symbol whose token is correct.

    (let [ops (filter #(and (isa? (:type %) :type/symbol)
                               (= (:token %) token)) input)
          result-sets-list (for [t ops
                   :let [remaining-input (disj input t)

                         ;; Potential left operands are expressions to the left of the operator
                         ;; with precedence greater than that of this operator.

                         potential-left-ops (filter #(and (geom/boxes-intersect? (geom/left-box t (* 2 (:width t)) (* 0.3 (:height t))) %)
                                                          (< (geom/bbox-right %) (:x (geom/bbox-middle t)))
                                                          (< (geom/bbox-right %) (+ (:left t) (* 0.5 (:width %))))
                                                          (isa? (:type %) :type/expr)
                                                          (> (precedence (:type %)) (precedence type))) remaining-input)

                         ;; Potential right operands are expressions to the right of the operator
                         ;; with precedence greater than that of this operator.

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

                 ;; Now we have the left and right operands, create a new result set combining them with the appropriate operator.
                 (conj remaining-input (merge {:id (:id t)
                                               :type type
                                               :left-op left
                                               :right-op right
                                               :symbol-count (+ 1
                                                                (:symbol-count left)
                                                                (:symbol-count right))}
                                              (geom/bbox-combine left right t)))))]

          ;; Concatenate all the result sets into a final list.
          (apply concat result-sets-list))))

(def non-var-symbols #{"+" "-" "="})

;; Each rule has an :apply function, which takes a set of entities and returns a list of sets of entities, where
;; each element of the list is a transformation of the input set, hopefully with some entities combined into bigger ones.
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

                      ;; A potential base is any expression which has higher precedence than :type/pow

                     (let [potential-bases (filter #(and (isa? (:type %) :type/expr)
                                                         (> (precedence (:type %)) (precedence :type/pow))) input)]
                       (apply concat
                              (for [b potential-bases
                                    :let [remaining-input (disj input b)

                                          ;; A potential exponent is any expression
                                          ;; which is touched by a north-east line from the top-right corner of the base
                                          ;; and which does not extend below or left of the centre of the base

                                          potential-exponents (filter #(and (geom/line-intersects-box? {:x (geom/bbox-right b) :dx (:width b)
                                                                                                        :y (:top b) :dy (- (:width b))} %)
                                                                            (> (:left %) (+ (:left b) (* 0.5 (:width b))))
                                                                            (< (+ (:top %) (:height %)) (+ (:top b) (* 0.5 (:height b))))
                                                                            (isa? (:type %) :type/expr)) remaining-input)]
                                    :when (not-empty potential-exponents)]
                                (for [e potential-exponents
                                      :let [remaining-input (disj remaining-input e)]]

                                  ;; Now we have found b^e and removed b and e from our input.
                                  ;; Create a new :type/pow which refers to them, and add it to the set of results

                                  (conj remaining-input (merge {:type :type/pow
                                                                :base b
                                                                :exponent e
                                                                :symbol-count (+ (:symbol-count b)
                                                                                 (:symbol-count e))}
                                                               (geom/bbox-combine b e))))))))}
   "adjacent-mult" {:apply (fn [input]

                              ;; Potential coefficients are expressions that have higher precedence than :type/mult

                             (let [potential-left-ops (filter #(and (isa? (:type %) :type/expr)
                                                                    (> (precedence (:type %)) (precedence :type/mult))) input)
                                   result-sets-list (for [left potential-left-ops
                                            :let [remaining-input (disj input left)

                                                  ;; Potential multiplicands are expressions to the right of "left"
                                                  ;; which have precedence >= :type/mult, which are not numbers.
                                                  ;; If they are of type :type/pow, the base must not be a number.
                                                  ;; If they are of type :type/mult, the left operand must not be a number.

                                                  potential-right-ops (filter #(and (geom/boxes-intersect? (geom/right-box left (* 2 (:width left)) (* 0.3 (:height left))) %)
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
                                                                                    (isa? (:type %) :type/expr)) remaining-input)]
                                            :when (not-empty potential-right-ops)]
                                        (for [right potential-right-ops
                                              :let [remaining-input (disj remaining-input right)]]

                                          ;; Now we have found coefficient and multiplicand and removed them from our input.
                                          ;; Create a new :type/mult and add it to the set of results.

                                          (conj remaining-input (merge {:type :type/mult
                                                                        :left-op left
                                                                        :right-op right
                                                                        :symbol-count (+ (:symbol-count left)
                                                                                         (:symbol-count right))}
                                                                       (geom/bbox-combine left right)))))]

                                ;; result-sets-list contains a list with an element for every potential coefficient
                                ;; where each element is a list of new result sets, one for each potential multiplicand.
                                ;; Join these nested lists together into a final list of results.

                                (apply concat result-sets-list)))}

   "addition" {:apply (binary-op-rule "+" :type/add)}
   "subtraction" {:apply (binary-op-rule "-" :type/sub)}
   "equals" {:apply (binary-op-rule "=" :type/eq)}
   "fraction" {:apply (fn [input]
                        (let [frac-lines (filter #(and (isa? (:type %) :type/symbol)
                                                   (= (:token %) :frac)) input)
                              result-sets-list (for [t frac-lines
                                       :let [remaining-input (disj input t)

                                             ;; Numerators/denominators must be expressions above/below the fraction line
                                             ;; that do not overhang the ends of the line by more than 10% of their width.

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
                                                                  (geom/bbox-combine t numerator denominator)))))]
                          (apply concat result-sets-list)))}})


;; The parse function takes an input set of items, each of which might be a symbol,
;; expression or equation etc., and attempts to combine them using the rules defined above.
;; This process will produce many possible output sets of items, with rules applied (or not) in various orders.
;; Returns a list of output sets of items.

(declare parse)
(def parse
  (memoize
   (fn [input]

     ;; For every rule, apply it to the input list

     (let [rule-outputs (for [[k r] rules
                          :let [new-inputs ((:apply r) input)]
                          :when (not-empty new-inputs)]

                          ;; new-inputs is now a list of result-sets. Each result set is a
                          ;; transformation of the original input, hopefully with some
                          ;; items combined by this rule.

                          ;; Parse each of these new result sets, in the hope of
                          ;; reducing them even further.
                          (let [new-inputs-parsed (for [i new-inputs]
                                                    (parse i))]

                            ;; new-inputs-parsed has an element for each of the new result sets.
                            ;; Each element is a list of output sets, so join these elements together,
                            ;; returning a full list of output sets that we might end up with after
                            ;; applying this rule.
                            (apply concat new-inputs-parsed)))]

       ;; rule-outputs is a list, where each element is a list of output sets derived from applying some rule.
       ;; Join all these lists together into one full list of possible output sets from all rules.
       ;; Remove duplicates which have arisen from applying rules in different orders with identical results.
       ;; Add the original input to this set of valid parses, and return.
       (cons input (distinct (apply concat rule-outputs)))))))



(defn to-clj-input [input]
  (set (map (fn [m] (apply merge (cons {:symbol-count 1} (map (fn [[k v]]
                                                               (cond (= :type k) {k (keyword v)}
                                                                     (and (= :token k)
                                                                          (string? v)
                                                                          (= (nth v 0) ":")) {k (keyword (.replace v ":" ""))}
                                                                     :else {k v})) m)))) (js->clj input :keywordize-keys true))))
(defn without-overlap [s]
  (set (filter #(not (:overlap %)) s)))


(defn map-with-meta [f m]
  (with-meta (map f m) (meta m)))

(defn get-best-results [input]
  (let [input         (to-clj-input input)
        all-symbols  (set (map :id (flatten (map symbols input))))

        result       (parse input)

        ;; result is now a list. Every set contains all the input items, combined by the rules in various ways.
        ;; Some will obviously be "better" than others, what follows is to choose these "good" parses.

        ;; Store the number of items and number of symbols in the metadata of each set.

        result       (map #(with-meta % {:orig-count (count %)
                                         :orig-symbol-count (apply + (map :symbol-count %))}) result)

        ;; For all those parse-sets that contain more than one final item,
        ;; find items that physically overlap and keep only the ones with the most symbols.

        result       (filter not-empty (map-with-meta geom/remove-overlapping result))

        ;; Add the removed sets back in to the results, but with a flag mentioning that they overlap.

        result       (map #(clojure.set/union % (set (map (fn [m] (assoc m :overlap true))
                                                          (:removed (meta %)))))
                          result)

        ;; Sort results by number of non-overlapping items, then
        ;; by the number of symbols in non-overlapping items.

        result       (sort (fn [a b] (let [ca (count (without-overlap a))
                                          cb (count (without-overlap b))]
                                      (if (= ca cb)
                                        (let [sa (apply + (map :symbol-count (without-overlap a)))
                                              sb (apply + (map :symbol-count (without-overlap b)))]
                                          (compare sb sa))
                                        (compare ca cb)))) result)

        least-things (count (without-overlap (first result)))
        most-symbols (apply + (map :symbol-count (without-overlap (first result))))

        best-results (distinct (apply concat (filter #(and (= least-things (count (without-overlap %)))
                                                           (= most-symbols (apply + (map :symbol-count (without-overlap %))))) result)))
        used-symbols (set (map :id (flatten (map symbols (filter #(not= (:type %) :type/symbol) (filter #(not (:overlap %)) best-results))))))

        unused-symbols (clojure.set/difference all-symbols used-symbols)

        best-results (filter #(and (not= (:type %) :type/symbol)
                                   (not (:overlap %))) best-results)]

    (println "***** Parse Results (Least things: " least-things ")*****")

    #_(pprint (map (fn [i] (cons (str "Orig count: " (:orig-count (meta i)))
                                (cons (str "New count: " (count i))
                                      (cons (str "Orig symbols: " (:orig-symbol-count (meta i)))
                                            (cons (str "New symbols: " (apply + (map :symbol-count i)))
                                                  (map simplify-map i)))))) (map without-overlap result)))
    (apply str (map print-expr (:parsed-math best-results)))
    (clj->js {:mathml (apply str (map mathml best-results))
              :unusedSymbols unused-symbols})))


(set! (.-onmessage js/self) (fn [e]
                              (let [symbols (.-data.symbols e)]
                                (.postmessage js/self (get-best-results symbols)))))
