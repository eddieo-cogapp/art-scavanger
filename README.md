# Generate Clues 

## Scrape landmarks 

First Scrape the landmarks in the Brighton area - [[To change area you would have to calculate the top left and bottom right of the desired region - and update clue-generator "brightonBouns"]]

### Set Env
Copy .env.example and set all env 

Google Places API Key required https://developers.google.com/maps/documentation/places/web-service/overview

### Run 

`node scrape-landmarks.js`

will be saved to /landmarks/all_landmarks.json

## Generate clues 

Will iterate through each item in the index - with ES variables and generate clues for each of them - saving to /data/all_clues.json

[[To update this value you have to edit clue-generator.js CONFIG]]

### Set Env

Copy .env.example 

Set Elastic values 

Set ANTHROPIC_API_KEY https://docs.claude.com/en/api/admin-api/apikeys/get-api-key

### Run 

`node clue-generator.js`


# Art Game 

Currently the clues need to be manually copied into the correct folder inside the app. This is have control over previous version of the clues + laziness

the clues must be in:

`art-game/data/artworks.json`


To start the art game run 

`cd art-game`

`npm install`
`npm run dev`


# Kibana 

You can spin up a Kibana instance to inspect the data 

copy root/.env.example - rename .env and set values 

To generate a token run
REPLACE_ME_WITH_PASSWORD - with the value. NOTE: you might need to escape ! in the password string e.g aa!bb become aa\!bb

`  curl -X POST "https://elastic.labs.cogapp.com/_security/service/elastic/kibana/credential/token/kibana-token" \
  -u elastic:REPLACE_ME_WITH_PASSWORD  \
  -H "Content-Type: application/json"`


  Update the values in .env then run 

  `docker compose up -d`

  Accessible at http://localhost:5601/. - elastic + password to get in