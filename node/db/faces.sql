WITH vecs AS (
  SELECT
    id,
    string_to_array(trim(both '[]' from embedding::text), ',')::float8[] AS arr
  FROM faces
),
expanded AS (
  SELECT
    id,
    arr,
    generate_subscripts(arr, 1) AS idx,
    arr[generate_subscripts(arr, 1)] AS val
  FROM vecs
),
norms AS (
  SELECT
    id,
    sqrt(SUM(val * val)) AS norm
  FROM expanded
  GROUP BY id
)
SELECT
  a.id AS face_a,
  b.id AS face_b,
  1 - SUM(a.val * b.val) / (na.norm * nb.norm) AS cosine_distance
FROM expanded a
JOIN expanded b ON a.idx = b.idx AND a.id < b.id
JOIN norms na ON na.id = a.id
JOIN norms nb ON nb.id = b.id
GROUP BY a.id, b.id, na.norm, nb.norm
ORDER BY cosine_distance ASC;
