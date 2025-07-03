# curl post body should have key "key" with value "value"

# get key from env and set it to key
key=$FOTD_KEY

curl -X POST "https://vexilo.org/api/fotd" -H "Content-Type: application/json" -d '{"key": "'$key'"}'

echo "Flag of the day generated"