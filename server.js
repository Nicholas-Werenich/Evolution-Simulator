/**
 * Evolater Backend Server
 * Handles POST requests to generate evolved creature states using OpenAI text and image models.
 * Integrates with Firebase Firestore for state storage.
 * 
 * TODO: Rate limiting, safeguards for innapropriate content and error handling for null image
 */
const fs = require('fs');
const express = require('express');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

//Access Keys
const dotenv = require('dotenv');
dotenv.config();

//OpenAI API
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const apiKey = process.env.OPENAI_API_KEY;

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
    // console.log("userId:", userId);
    console.log("creatureId:", creatureId);
    console.log("data:", data);

    try {

        //Check if environment is null
        creatureEnvironment ??= defaultEnvironment;

        /*
        const creatureRef = db
            .collection('users')
            .doc(userId)
            .collection('creatures')
            .doc(creatureId);

        */

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
            //console.log(newCreature.image);

            //Update for next iteration
            //({ creatureDescription, creatureImage } = newCreature);
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
    // const textResponse = await openai.chat.completions.create({
    //     model: "gpt-4.1-nano",
    //     messages: [
    //         //{ role: "user", content: `${textPromptAddon} \n ${creatureDescription} \n The environment of the creature is: \n ${creatureEnvironment}` }
    //         //{ role: "user", content: `Describe the image: ${imgData}` }
    //         {
    //             role: "user",
    //             content: [
    //                 {
    //                     "type": "text",
    //                     "text": "What’s in this image?"
    //                 },
    //                 {
    //                     "type": "image_url",
    //                     "image_url": {
    //                         "url": `data:image/png;base64,${imgData}`
    //                     }
    //                 }
    //             ]
    //         }]
    // });

    //const textData = textResponse.choices[0].message.content

    /*
    //Test image due to expensive API calls
    const imgResponse = {
        data: [
            {
                url: "https://na.rdcpix.com/8521745db8e94d6b8320a7809d0d3e4dw-c1075410791srd-w928_q80.jpg"
            }
        ]
    };
    */

    // const imgResponse = await openai.images.generate({
    //     model: "gpt-image-1",
    //     prompt: "Create a picture of some bodacious low poly aliens cracking each other",
    //     //prompt: `${imagePromptAddon} \n ${creatureImage} \n ${textData}`,
    //     n: 1,
    //     size: imageResolution,
    // });


    const imgResponse = await GenerateImage("creatureImage");

    console.log(imgResponse.data[0].url);

    const base64image = await convertImageUrlToBase64(imgResponse.data[0].url);

    await SaveBase64FileTesting(base64image, "generatedImages/", (err) => {
        console.log("Error: " + err);
    });

    return {
        creatureDescription: textData,
        image: imgData
    };
}

async function convertImageUrlToBase64(imageUrl) {
    try {

        const response = await fetch(imageUrl);
        const buffer = await response.buffer();
        const base64String = buffer.toString('base64');

        return `data:image/png;base64,${base64String}`;

    } catch (error) {
        console.error("Error converting image URL to base64:", error);
    }
}

async function SaveBase64FileTesting(content, filePath) {
    fs.writeFile(filePath, content, 'utf8', () => {
        console.log('Saved to: ', filePath);
    });
}

async function GenerateImage(prompt) {


    const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            prompt: prompt,
            n: 1,
            size: size,
        }),
    });

    const data = await response.json();
    return data.data[0].url;
}


//Server start
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});