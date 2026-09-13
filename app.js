const express = require('express');
const app = express();
const path = require('path')
const pageRoutes = require("./routes/pages");
require('dotenv').config()

const PORT = process.env.PORT

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/", pageRoutes);

app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'API is running' });
});


app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
});

app.use(express.static("public"));


