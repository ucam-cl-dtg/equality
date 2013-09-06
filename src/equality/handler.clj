(ns equality.handler
  (:use [compojure.core]
        [hiccup.core]
        [hiccup.page]
        [clojure.pprint]
        [equality.printing])
  (:require [compojure.handler :as handler]
            [compojure.route :as route]
            [equality.parser :as parser]
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
    (set (map (fn [m] (apply merge (map (fn [[k v]]
                                         (cond (= :type k) {k (keyword v)}
                                               (and (= :token k)
                                                    (string? v)
                                                    (.startsWith v ":")) {k (keyword (.replace v ":" ""))}
                                               :else {k v})) m))) input))))

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
  (POST "/parse" {body :body} (let [body (read-body body)
                                    result (doall (parser/parse body parser/rules))]
                                ;;(pprint body)
                                (println "***** Parse Results *****")
                                (apply str (map print-expr result))
                                (apply str (map mathml result))))
  (route/resources "/")
  (route/not-found "Not Found"))

(def app
  (handler/site app-routes))
