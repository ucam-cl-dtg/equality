(ns equality.geometry
  (:use [clojure.pprint]))

;; Lines are {:x :y :dx :dy}
;; Boxes are {:left :top :width :height}

(defn cross [v w]
  (- (* (:dx v) (:dy w))
     (* (:dy v) (:dx w))))

(defn v- [a b]
  {:dx (- (:x a) (:x b))
   :dy (- (:y a) (:y b))})

(defn lines-intersect? [l1 l2]
  ;; From http://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect
  (let [p l1
        q l2
        r l1
        s l2
        cross-rs (cross r s)]
    (when (not= (float cross-rs) 0.0)
      (let [t (/ (cross (v- q p) s) cross-rs)
            u (/ (cross (v- q p) r) cross-rs)]
        (and (>= t 0)
             (<= t 1)
             (>= u 0)
             (<= u 1))))))

(defn box-lines [box]
  [{:x (:left box) :dx 0
    :y (:top box) :dy (:height box)}
   {:x (+ (:left box) (:width box)) :dx 0
    :y (:top box) :dy (:height box)}
   {:x (:left box) :dx (:width box)
    :y (:top box) :dy 0}
   {:x (:left box) :dx (:width box)
    :y (+ (:top box) (:height box)) :dy 0}])

(defn line-intersects-box? [line box]
  ;; Either the line is completely contained within the box,
  ;; or it intersects with one of the sides of the box.
  ;; Actually, it's enough to test if one end is inside the box.
  (or (and (> (:x line) (:left box))
           (< (:x line) (+ (:left box) (:width box)))
           (> (:y line) (:top box))
           (< (:y line) (+ (:top box) (:height box))))
      (some #(lines-intersect? line %) (box-lines box))))

(defn boxes-intersect? [box1 box2]
  (some #(line-intersects-box? % box2) (box-lines box1)))
