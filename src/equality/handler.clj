(ns equality.handler
  (:use [compojure.core]
        [hiccup.core]
        [hiccup.page]
        [clojure.pprint]
        [equality.printing])
  (:require [compojure.handler :as handler]
            [compojure.route :as route]
            [equality.parser :as parser]
            [equality.geometry :as geom]
            [clojure.data.json :as json]))

(def simple-input
  #{
    {:token "x"
     :type :type/var
     :prec 999
     :top 100 :left 100 :width 30 :height 30}
    {:token "2"
     :type :type/num
     :prec 999
     :top 92 :left 125 :width 20 :height 20}
    })
(def test-input
  #{
    {:token "x"
     :type :type/var
     :prec 999
     :top 100 :left 100 :width 30 :height 30}
    {:token "2"
     :type :type/num
     :prec 999
     :top 92 :left 125 :width 20 :height 20}
    {:token "+"
     :type :type/symbol
     :top 100 :left 140 :width 30 :height 30}
    {:token "y"
     :type :type/var
     :prec 999
     :top 100 :left 170 :width 30 :height 30}
    {:token "3"
     :type :type/num
     :prec 999
     :top 92 :left 195 :width 20 :height 20}
    {:token :frac
     :type :type/symbol
     :top 135 :height 1 :left 100 :width 120}
    {:token "8"
     :type :type/num
     :prec 999
     :top 145 :height 30 :left 145 :width 30}
    {:token "9"
     :type :type/num
     :prec 999
     :top 80 :left 140 :width 15 :height 15}
    })

(defn render-thing [i]
  (when (string? (:token i))
    (:token i)))

(defn read-body [body]
  (let [input (json/read-str (slurp body) :key-fn keyword)]
    (set (map (fn [m] (apply merge (cons {:symbol-count 1} (map (fn [[k v]]
                                               (cond (= :type k) {k (keyword v)}
                                                     (and (= :token k)
                                                          (string? v)
                                                          (.startsWith v ":")) {k (keyword (.replace v ":" ""))}
                                                          :else {k v})) m)))) input))))

(defn simplify-map [m]
  (with-meta (dissoc (apply merge (map (fn [[k v]] (if (map? v)
                                                    {k (simplify-map v)}
                                                    {k v})) m))
                     :left :top :width :height ) (meta m)))

(defn map-with-meta [f m]
  (with-meta (map f m) (meta m)))

(defn without-overlap [s]
  (set (filter #(not (:overlap %)) s)))

(defn home-page []
  (html5
   [:head [:title "Equality"]
    (include-css "css/equality.css")
    (include-js "http://code.jquery.com/jquery-1.10.1.min.js")
    (include-js "http://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML")
    (include-js "js/equality.js")]
   [:body [:h1 "Equality"]
    [:div#canvas
     #_(for [i test-input]
       [:div (merge
              {:style (str "left:" (:left i)
                           "px;top:" (:top i)
                           "px;width:" (:width i)
                           "px;height:" (:height i)
                           "px;line-height:" (:height i)
                           "px;font-size:" (:height i)
                           "px;")
               :data-type (str (namespace (:type i)) "/" (name (:type i)))
               :data-token (str (:token i))
               :class "symbol"}
              (when (keyword? (:token i))
                {:class (str "symbol " (name (:token i)))})
              (when (:prec i)
                {:data-prec (:prec i)})) (render-thing i)])]
    [:button.parse {:type :button} "Parse"]
    [:div#output]]))

(defroutes app-routes
  (GET "/" [] (home-page))
  (POST "/parse" {body :body}
        (dorun (repeatedly 100 println))
        (let [body         (read-body body)
              all-symbols  (set (map :id (flatten (map parser/symbols body))))
_              (pprint all-symbols)
              result       (parser/parse body parser/rules)
              ;;result       (map-indexed (fn [i es] (set (map #(assoc % :group i) es))) result)
              result       (map #(with-meta % {:orig-count (count %)
                                               :orig-symbol-count (apply + (map :symbol-count %))}) result)
              result       (filter not-empty (map-with-meta geom/remove-overlapping result))
              result       (map #(clojure.set/union % (set (map (fn [m] (assoc m :overlap true)) (:removed (meta %))))) result)
              ;;_ (pprint removed)
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
              used-symbols (set (map :id (flatten (map parser/symbols (filter #(not= (:type %) :type/symbol) (filter #(not (:overlap %)) best-results))))))

              unused-symbols (clojure.set/difference all-symbols used-symbols)

              best-results (filter #(and (not= (:type %) :type/symbol)
                                         (not (:overlap %))) best-results)]
;;          (pprint body)

;;          (pprint all-symbols)
;;          (pprint used-symbols)
;;          (pprint unused-symbols)
          (println "***** Parse Results (Least things: " least-things ")*****")

          (pprint (map (fn [i] (cons (str "Orig count: " (:orig-count (meta i)))
                                    (cons (str "New count: " (count i))
                                          (cons (str "Orig symbols: " (:orig-symbol-count (meta i)))
                                                (cons (str "New symbols: " (apply + (map :symbol-count i)))
                                                      (map simplify-map i)))))) (map without-overlap result)))
          (apply str (map print-expr (:parsed-math best-results)))
          (json/write-str {:mathml (apply str (map mathml best-results))
                           :unusedSymbols unused-symbols
                           ;;:overlap (map :id (map parser/symbols (:overlap best-results)))
                           })))
  (route/resources "/")
  (route/not-found "Not Found"))

(def app
  (handler/site app-routes))
