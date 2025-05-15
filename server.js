const express = require('express');
const admin = require('firebase-admin');

//Firebase Admin SDK
const privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+EA7F8pTh46+S\nbjDz0ZBJwkzc9JYEKICKd5vaTdKY+3pJKKKMkzZ0pgmTozKyXkaec3RLdLdWMxs9\ntuTX+ZBfk/hkrtFJ8KKJjHCG5v9VzdS9sxvzP0Yn4gOitUfkh+oH9VHaZ6QuTkci\nSsyGn9dMNcslFgzZ65HNhmm85C6d4estS4NJA4K651Pc3VxPT2tDFDdZirVrtoPF\n4uGlptMp5F8z0q5opVH32UkfkJQzjFQbj3n2UGXC99/lIxUI7YxrxgGnhxP9YLON\nAeQ/Zr7OELimvhRrg1wsnMAURjpTKm/P3v3AdhukZ2JKlf8fLYsD5yCfzGvRyEa5\nvo2uRochAgMBAAECggEAFUgqRVFASUpz0YlP5y9JMS8l6Oxkw2avHQIfZBqIeTuY\ngepgSC4gP//LDPpuTfF3Rh0OsbfKIydyFo8dEQ93cnJY0xpNolJE+vKsM3jYcLjN\naGfuumY0gnkA9/ZFTHJJGvbF4XcvN8WpWq5GOFFb2+NeocKWMg0aDInPW3iv/Rra\nb6HAvlay7GnOxKDLAQKKnu0t40dwyzd9AdQ3zhnrTm5XNZC/13uphACgis7UwJ/x\nFl+2T463P86HBnK5HJoLG2FqW8gKTHLDPk+D6wDCBegWfzwMplWjugbAiscMzkv2\nBF3E+yUgv+Ya8lXKKo7GJ8JVOF5r8WpivGQSKjl0yQKBgQDhm0xJ5YyJIFIoOdBi\nGcgDgPMAnyveu9PYqbQM5S1P6jgH3aac8oyEHd1Wvka6PgcBrLovMsUuG8tgy3kd\nQheb6zyyZ3GQNMrOLcxVgVf7WlyUCXODDxanHZ2FoypzGVfsSSLQOGDz3L3MCJvK\nCQXBX3vMOQadccFfIso1liOGOQKBgQDXquysi6HxvxT3OWqc9ZiU57Zbw619KXnx\nuDUbD3SXvp1vm1nK8RI03ae7ivwmxNYRu1s1o+XSHWGNysaTcK536UqMGtoiF7Gw\nOM4E8zC1zCRskjaxE115Mb5IbOSWSrFrLZxu8bKm+XYuLzfn70qHuKlokRVXj+ZR\nEXbxe4ZIKQKBgQChCzhz75ZYNGgxKsPjoz+xsJTGNtkcD7vzh4BtTBMCXtFMXB6Z\nHlLL5H2hdAYM4EYkHeZx1q4GcfTFzblQ92Le/BbByzG3nNfAQdUAnGnvlNtNGUoJ\nnfWvqWZOhODCdK7cjoB5XiVnLoWVZfe/Sp1/Iee/Kl3ced1tSepKQjhtkQKBgQCT\nWQxqttvmNw8z+d6FbqbY1ZcaCw81PGk8ZQajfmPCaVFXN2SZ6yrtQ6Od1s+ADWvU\noZUniNs0Oy6zmZ8ijRImixWLs6zlLhsQsz7O0visvNUF+L+1K+3pJ7tB8GQc6ttc\nxsTiZ/APdNDxrQEdTbg2EkxsTPOv53kMWkpRonuUQQKBgCZcY6PPi/sTXc5KqdrZ\ngPBaSZNKH9Ih4XxGbRg0d81v1ZtCS6vdxznoWAYL12C0hj5IC0PDW3mf3QIEhy92\ndrS3psoT1ZsNn3B4DZ5GGCMe+GRUvdSTwv17JoAsFMeVp9qfUADKlszlzOjqklYt\nnYemZBvMdCL29K1hTXxUvINE\n-----END PRIVATE KEY-----\n"
admin.initializeApp({
    credential: admin.credential.cert(privateKey)
});

const db = admin.firestore();
const app = express();
const port = process.env.PORT || 3000;

//API config
const defualtEnvironment = "Fill in with specifics about earth";
const imagePromptAddon = "Dylans prompt";
const textPromptAddon = "Dylans prompt";

const creatureStages = 3;



//Middleware
app.use(express.json());

//Endpoint for generating creature
app.post('/process-data', async (req, res) => {
    let { creatureDetails, creatureEnvironment, creatureImage } = req.body;

    try {
        //Create session with OpenAI

        //Check if enviroment is defualt
        creatureEnvironment ??= defualtEnvironment;


        for (let i = 0; i < creatureStages; i++) {
            ({ creatureDetails, creatureEnvironment, creatureImage }) = CreatureOutput(creatureDetails, creatureEnvironment, creatureImage);
            //Store current stage into firestore
        }




        res.status(200).json({ message: 'Data processed successfully' });  // Placeholder success response
    } catch (error) {
        console.error('Error processing data:', error);
        res.status(500).json({ error: 'Failed to process data' });  // Error response if anything goes wrong
    }
});

async function CreatureOutput(creatureDetails, creatureEnvironment, creatureImage) {

    //Call 4o mini api for text generation for what changed part and definition, use what changed for image and text, use definition for next input


    //Call Image Generation API for image

}

//Server start
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});