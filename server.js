/**
 * Evolater Backend Server
 * Handles POST requests to generate evolved creature states using OpenAI text and image models.
 * Integrates with Firebase Firestore for state storage.
 * 
 * TODO: safeguards for innapropriate content and error handling for null image, timeouts for image generation
 */
const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
const sharp = require('sharp');
const path = require('path');
const { toFile } = require("openai");
const cors = require('cors');

//Access Keys
const dotenv = require('dotenv');
dotenv.config();

//Imgur API
const clientID = process.env.IMGUR_CLIENT_ID;

//OpenAI API
const OpenAI = require('openai');
const { create } = require('domain');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//Firebase Admin SDK
const firebaseAdmin = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(firebaseAdmin),
});

const db = admin.firestore();

//Prompts
const defaultEnvironment = "Earth";
const imagePromptAddon = "You are a 3D artist specializing in low-poly PS2-era game graphics. Create a creature inspired by a child's simple drawing. The model should have: PS2 - era polygon count(simple geometry, low detail) A single soft color with slight tonal variation Smooth hard - edged surfaces, no high - resolution textures Anatomically believable but exaggerated cartoon - like proportions. Standing in a neutral pose on a plain, empty background. Simple lighting that softly highlights the polygon edges. Describe the result in a way that matches this style.";
const textPromptAddon = "Addon features to this creature by 'evolving' it. The response should be a short paragraph of the creatures evolved features";
const choicePrompt = "Create a scenario where a creature is faced with a yes/no decision. The scenario should be general and not mention the creature directly. The outcome of each choice should be ambiguous, with one leading to an evolutionary advantage and the other to extinction, but it should not be clear which is which. It should also be fairly unspecific so many creatures can fit the senario. The format must be exactly: \nScenario: [Short description of the situation]\nYes: [Action taken if yes]\nNo: [Action taken if no]";

//Current minimum size accepted
const imageResolution = "1024x1024";


//Frontend config
const app = express();
const port = process.env.PORT || 3000;

//Rate limiting
const limiter = rateLimit({
    //8 requests per minute
    windowMs: 60 * 1000,
    max: 8,
    message: { error: "Too many requests, slow down." }
});

app.use(limiter);
//Express middleware
//Size limit set for 50mb to allowe for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

app.use(cors());

//Add creature endpoint
app.post("/add-creature", async (req, res) => {

    const { userId, creatureId, data } = req.body;
    const { state: state, name: name, img: creatureImage, description: creatureDescription } = data;

    console.log("Received POST data:");
    console.log("creatureId:", creatureId);
    console.log("data:", data);

    try {

        const imgResponse = await GenerateImage(`${imagePromptAddon} \n ${creatureDescription}`, creatureImage);

        //Shrink image
        const shrunkImg = await ShrinkImage(imgResponse);


        const choicesString = await TextGenerator(choicePrompt);
        console.log(choicesString);
        const choices = choicesString.split('\n').filter(l => l.trim() !== '');

        await SaveBase64FileTesting(shrunkImg, `generatedImages/creature15.txt`, (err) => {
            console.log("Error: " + err);
        });



        //Save to firebase
        const creatureRef = db
            .collection('users')
            .doc(userId)
            .collection('creatures')
            .doc(creatureId);

        const newState = {
            changes: `Here is your own creature come alive! ${name} is the newest kid on the block.`,
            choice: {
                changes: [
                    choices[1],
                    choices[2]
                ],
                options: [
                    "Yes",
                    "No"
                ],
                title: choices[0],
            },
            dateAdded: new Date(),
            image: `data:image/png;base64,${shrunkImg}`,
            state: state + 1
        };

        await SaveCreatureState(creatureRef, newState);

        res.status(200).json({ message: 'Data processed successfully' });
    }
    catch (error) {
        console.error('Error processing data:', error);
        res.status(500).json({ error: 'Failed to process data' });
    }
})

//Evolve createure endpoint
app.post("/evolve-creature", async (req, res) => {


    const { userId, creatureId, data, choice } = req.body;
    const { state: state, image: creatureImage, title: extinctionEvent, choice: choices } = data;

    const changes = choices.changes[choice];

    const evolutionTrigger = `The creature evolved to survive ${extinctionEvent} by changing like this: ${changes}`;

    //Testing recieved data
    console.log("Received POST data:");
    console.log("creatureId:", creatureId);
    console.log("Choice:", choice);
    console.log("data:", data);

    try {

        //Check if environment is null
        //creatureEnvironment ??= defaultEnvironment;

        const creatureRef = db
            .collection('users')
            .doc(userId)
            .collection('creatures')
            .doc(creatureId);


        if (choice == 1) {
            await ExtinctCreature(creatureRef, extinctionEvent);
            res.status(200).json({ message: 'Data processed successfully' });
            return;
        }


        const newCreature = await NewCreatureState(creatureImage, evolutionTrigger);

        const choicesString = await TextGenerator(choicePrompt);
        console.log("Choices: ", choicesString);
        const choices = choicesString.split('\n').filter(l => l.trim() !== '');

        console.log(newCreature.creatureDescription);

        const newState = {
            changes: newCreature.creatureDescription,
            choice: {
                changes: [
                    choices[1],
                    choices[2]
                ],
                extinct: 1,
                options: [
                    "Yes",
                    "No"
                ],
                title: choices[0],
            },
            dateAdded: new Date(),
            image: `data:image/png;base64,${newCreature.image}`,
            state: state + 1
        };

        await SaveCreatureState(creatureRef, newState);


        res.status(200).json({ message: 'Data processed successfully' });
    }
    catch (error) {
        console.error('Error processing data:', error);
        res.status(500).json({ error: 'Failed to process data' });
    }
});

//Take in image and text prompts to generate the next evolutionary state of the creature
async function NewCreatureState(creatureImage, evolutionTrigger) {

    //Upload image to Imgur
    //const imgURL = await UploadToImgur(creatureImage);

    //Creature evolution text
    const textData = await TextGenerator(`${textPromptAddon} \n ${evolutionTrigger}`, creatureImage);
    // const textData = await TextGenerator(`${textPromptAddon} \n ${evolutionTrigger}`, imgURL.url);
    console.log("Text response: ", textData);

    //The text prompt for image generation
    const imgPrompt = `${imagePromptAddon} \n ${textData}`;

    //Generate image using text prompt and base64 reference image
    const imgResponse = await GenerateImage(imgPrompt, creatureImage);

    //Delete the image from Imgur
    //console.log(await DeleteFromImgur(imgURL.deleteHash));

    //Shrink image from 1024x1024 to 512x512 
    const imgData = await ShrinkImage(imgResponse);

    //Save base64 image to text file for verification
    await SaveBase64FileTesting(imgData, `generatedImages/creature17.txt`, (err) => {
        console.log("Error: " + err);
    });

    return {
        creatureDescription: textData,
        image: imgData
    };
}

async function TextGenerator(prompt, base64 = null) {

    if (base64) {
        const textResponse = await openai.chat.completions.create({
            model: "gpt-4.1-nano",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: base64
                            }
                        },
                        {
                            type: "text",
                            text: prompt
                        }
                    ]
                }
            ],
        });
        return textResponse.choices[0].message.content;
    }
    else {
        const textResponse = await openai.chat.completions.create({
            model: "gpt-4.1-nano",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        }
                    ]
                }
            ],
        });
        return textResponse.choices[0].message.content;
    }
}


async function GenerateImage(prompt, base64String) {

    //Remove the base64 prefix
    const base64 = base64String.replace(/^data:image\/\w+;base64,/, "");

    const buffer = Buffer.from(base64, 'base64');

    const imgObject = await toFile(buffer, "image.png", {
        type: "image/png",
    });

    const response = await openai.images.edit({
        model: "gpt-image-1",
        quality: "low",
        background: "transparent",
        size: imageResolution,
        image: imgObject,
        prompt,
    });

    return response.data[0].b64_json;
}

async function ShrinkImage(image) {
    try {

        const buffer = Buffer.from(image, 'base64');

        //Change to 512x512 to keep dimensions but shrink file size
        const resizedBuffer = await sharp(buffer)
            .resize(512, 512)
            .png()
            .toBuffer();

        //Add base64 image prefix
        return resizedBuffer.toString('base64');
    } catch (error) {
        console.error('Error:', error);
    }
}


async function SaveCreatureState(creatureRef, newState) {

    try {
        await creatureRef.collection('states').add(newState);
        console.log('Creature state saved successfully:', newState.state);
    }
    catch (error) {
        console.error('Error saving creature state:', error);
        throw new Error('Failed to save creature state');
    }
}

async function ExtinctCreature(creatureRef, extinctionEvent) {

    const deathTagline = TextGenerator(`A creature has gone extinct due to ${extinctionEvent}. In a short one line tagline  state how it lost. Example: 'The creature was unable to adapt to the changing environment and died out.'`);
    const newState = {
        changes: deathTagline,
        state: state + 1
    };
    try {
        await creatureRef.collection('states').add(newState);
        console.log('Creature state saved successfully:', newState.state);
    }
    catch (error) {
        console.error('Error saving creature state:', error);
        throw new Error('Failed to save creature state');
    }
}

async function UploadToImgur(base64Image) {
    const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
            Authorization: `Client-ID ${clientID}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: base64Image,
            type: 'base64',
        }),
    });

    const result = await response.json();

    if (!result.success) {
        console.error(result);
        throw new Error('Failed to upload to Imgur');
    }

    console.log('Imgur URL:', result.data.link);

    return {
        url: result.data.link,
        deleteHash: result.data.deletehash
    };
}

async function DeleteFromImgur(deleteHash) {
    const response = await fetch(`https://api.imgur.com/3/image/${deleteHash}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Client-ID ${clientID}`
        }
    });

    const result = await response.json();
    console.log(result);
}

async function SaveBase64FileTesting(content, filePath) {
    fs.writeFile(filePath, content, 'utf8', () => {
        console.log('Saved to: ', filePath);
    });
}
//Server start
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});