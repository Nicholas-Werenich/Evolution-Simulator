/**
 * Evolater Backend Server
 * Handles POST requests to generate evolved creature states using OpenAI text and image models.
 * Integrates with Firebase Firestore for state storage.
 * 
 * TODO: Rate limiting, safeguards for innapropriate content and error handling for null image
 */

const express = require('express');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

//Access Keys
const dotenv = require('dotenv');
dotenv.config();

//OpenAI API
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//Firebase Admin SDK
const firebaseAdmin = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(firebaseAdmin),
});
const db = admin.firestore();

//Frontend config
const path = "/users/:userId/creatures/:creatureId/states/:randomId";
const app = express();
const port = 3000;

//API config
const defaultEnvironment = "Fill in with specifics about earth";
const imagePromptAddon = "Dylans prompt";
const textPromptAddon = "Dylans prompt";

//Current minimum size accepted
const imageResolution = "1024x1024";
const creatureStages = 1;

//Middleware
app.use(express.json());

//Endpoint for generating creature
app.post(path, async (req, res) => {


    const { userId, creatureId, data } = req.body;
    const { state, creatureImage, name, creatureDescription, creatureEnvironment } = data;

    //Testing recieved data
    console.log("Received POST data:");
    console.log("userId:", userId);
    console.log("creatureId:", creatureId);
    console.log("data:", data);

    try {

        //Check if environment is null
        creatureEnvironment ??= defaultEnvironment;

        const creatureRef = db
            .collection('users')
            .doc(userId)
            .collection('creatures')
            .doc(creatureId);

        for (let i = 0; i < creatureStages; i++) {
            const newCreature = await CreatureOutput(creatureDescription, creatureImage, creatureEnvironment);


            /*
            Commented out due to testing, don't want to interfere with the database

            const newState = {
                dateAdded: new Date(),
                image: newCreature.image,
                state: i,
                changes: newCreature.creatureDescription,
            };

            await creatureRef.collection('states').add(newState);
            */


            //Testing OpenAI output
            console.log(newCreature.creatureDescription);
            console.log(newCreature.image);

            //Update for next iteration
            ({ creatureDescription, creatureImage } = newCreature);
        }

        res.status(200).json({ message: 'Data processed successfully' });
    } catch (error) {
        console.error('Error processing data:', error);
        res.status(500).json({ error: 'Failed to process data' });
    }
});

//Take in image and text prompts to generate the next evolutionary state of the creature
async function CreatureOutput(creatureDescription, creatureImage, creatureEnvironment) {

    //Text generation
    const textResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "user", content: `${textPromptAddon} \n ${creatureDescription} \n The environment of the creature is: \n ${creatureEnvironment}` }
        ]
    });

    //Image generation
    const textData = textResponse.choices[0].message.content

    const imgResponse = await openai.images.generate({
        model: "gpt-image-1",
        prompt: `${imagePromptAddon} \n ${creatureImage} \n ${textData}`,
        n: 1,
        size: imageResolution,
    });


    /*Test image due to expensive API calls
    const imgResponse = {
        data: [
            {
                url: "https://na.rdcpix.com/8521745db8e94d6b8320a7809d0d3e4dw-c1075410791srd-w928_q80.jpg"
            }
        ]
    };
    */

    //Convert image to base64 to store in database
    const imgData = await UrlToBase64(imgResponse.data[0].url);

    return {
        creatureDescription: textData,
        image: imgData
    };
}

//Fetch image URL and convert to base64
async function UrlToBase64(imageUrl) {
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    return base64;
}

//Server start
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});