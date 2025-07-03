# curl post body should have key "key" with value "value"

# get key from env and set it to key
key=$FOTD_KEY

# url="http://localhost:3001/api/fotd"
url="https://vexilo.org/api/fotd"

echo "URL: $url"

curl -X POST "$url" -H "Content-Type: application/json" -d '{"key": "'$key'"}'