const { sequelize } = require('../models');

async function initDatabase() {
    try {
        await sequelize.authenticate();

        console.log('MySQL database connected successfully');

        await sequelize.sync({
            alter: false
        });

        console.log('Database tables synchronized');

    } catch (error) {
        console.error(
            'Database connection failed:',
            error.message
        );

        throw error;
    }
}

module.exports = initDatabase;