(defproject equality "0.1.0-SNAPSHOT"
  :description "FIXME: write description"
  :url "http://example.com/FIXME"
  :dependencies [[org.clojure/clojure "1.5.1"]
                 [compojure "1.1.5"]
                 [hiccup "1.0.4"]
				 [org.clojure/data.json "0.2.2"]
                 [org.clojure/clojurescript "0.0-2014"
                  :exclusions [org.apache.ant/ant]]]
  :plugins [[lein-cljsbuild "1.0.2"]
            [lein-ring "0.8.5"]]
  :ring {:handler equality.handler/app}
  :cljsbuild {
    :builds [{:source-paths ["src-cljs"]
              :compiler {:output-to "resources/public/js/parser.js"
                         :optimizations :whitespace
                         :pretty-print true}}]}
  :profiles
  {:dev {:dependencies [[ring-mock "0.1.5"]]}})
