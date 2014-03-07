(ns equality.handler
  (:use [compojure.core]
        [hiccup.core]
        [hiccup.page]
        [clojure.pprint])
  (:require [compojure.handler :as handler]
            [compojure.route :as route]
            [clojure.data.json :as json]))

(defn render-thing [i]
  (when (string? (:token i))
    (:token i)))

(defn simplify-map [m]
  (with-meta (dissoc (apply merge (map (fn [[k v]] (if (map? v)
                                                    {k (simplify-map v)}
                                                    {k v})) m))
                     :left :top :width :height ) (meta m)))

(defn home-page []
  (html5
   [:head [:title "Equality"]
    (include-css "css/equality.css")
    (include-js "http://code.jquery.com/jquery-1.10.1.min.js")
    (include-js "http://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML")
    (include-js "js/parser.js")
    (include-js "js/equality.js")]
   [:body [:h1 "Equality"]
    [:div#canvas
      [:div#instructions
        "To get started, click anywhere on this canvas and type a simple expression, such as \"1+2x=5\""
        [:p]
        "Click on symbols to move them around or resize them."
        [:p]
        "Right click to add a fraction"
        [:p]
        "Arrange your equation as you would on paper"]]
    [:button.parse {:type :button} "Parse"]
    [:div#output
    [:div#instructionsOutput
    "Parsed equations will appear here."]]]))

(defroutes app-routes
  (GET "/" [] (home-page))

  (route/resources "/")
  (route/not-found "Not Found"))

(def app
  (handler/site app-routes))
