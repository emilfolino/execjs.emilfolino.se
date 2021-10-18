const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require("child_process");

const app = express();
const port = 8234;

// don't show the log when it is test
if (process.env.NODE_ENV !== 'test') {
    // use morgan to log at command line
    app.use(morgan('combined')); // 'combined' outputs the Apache style LOGs
}

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.post("/code", function (req, res) {
    let buff = Buffer.from(req.body.code, "base64");
    let decoded;

    try {
        decoded = buff.toString('ascii');
    } catch {
        return res.status(500).json({
            errros: {
                status: 500,
                title: "Not base64",
                message: "Could not decode base64.",
                path: "/code",
            }
        });
    }

    let matches = decoded.match(/require\(/g);
    if (matches) {
        return res.status(500).json({
            errros: {
                status: 500,
                title: "Requires not allowed",
                message: "",
                path: "/code",
            }
        });
    }

    // create file in docker folder with decoded content
    const data = new Uint8Array(Buffer.from(decoded));
    fs.writeFile('./docker/hello.js', data, (err) => {
        if (err) throw err;

        // execute docker run command
        exec(`cd docker && docker build -t hello . > /dev/null 2>&1 && docker run --memory=1g --cpus=".5" hello`, (error, stdout, stderr) => {
            let output;

            if (error) {
                output = error.message;
            } else if (stderr) {
                output = stderr;
            } else {
                output = stdout;
            }

            // Encode output to base64
            buff = Buffer.from(output);

            let encodedOutput = buff.toString('base64');

            return res.status(201).json({
                data: encodedOutput,
            });
        });
    });
});

app.get('/', (req, res) => {
    res.redirect('/documentation.html');
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
