const express = require('express');
const app = express();
const path = require('path');

require('dotenv').config();

const pageRoutes = require('./routes/pages');
const telkomRoutes = require('./routes/telkomRoutes');
const callbackRoutes = require('./routes/callbackRoutes');

const initDatabase = require('./config/initDatabase');

const PORT = process.env.PORT || 3000;


// ======================================================
// VIEW ENGINE
// ======================================================

app.set('view engine', 'ejs');

app.set(
    'views',
    path.join(__dirname, 'views')
);


// ======================================================
// PROXY
// ======================================================

app.set('trust proxy', true);


// ======================================================
// BODY PARSER
// ======================================================

app.use(
    express.json({
        limit: '2mb'
    })
);

app.use(
    express.urlencoded({
        extended: true
    })
);


// ======================================================
// STATIC FILES
// ======================================================

app.use(
    express.static(
        path.join(__dirname, 'public')
    )
);


// ======================================================
// WEBSITE / PAGE ROUTES
// ======================================================

app.use(
    '/',
    pageRoutes
);


// ======================================================
// TELKOM PARTNERHUB API
// ======================================================

app.use(
    '/api/telkom',
    telkomRoutes
);


// ======================================================
// TELKOM CALLBACKS
// ======================================================

app.use(
    '/api/callbacks',
    callbackRoutes
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/health', (req, res) => {

    res.json({
        success: true,
        message: 'API is running',
        environment: process.env.TELKOM_ENV || 'staging'
    });

});


// ======================================================
// ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {

    console.error(err);

    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });

});


// ======================================================
// START SERVER
// ======================================================

async function startServer() {

    try {

        await initDatabase();

        app.listen(PORT, () => {

            console.log(
                `API listening on port ${PORT}`
            );

            console.log(
                `Telkom environment: ${process.env.TELKOM_ENV || 'staging'}`
            );

        });

    } catch (error) {

        console.error(
            'Server startup failed:',
            error
        );

        process.exit(1);
    }
}

startServer();