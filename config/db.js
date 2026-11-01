const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        dialect: 'mysql',

        logging: process.env.NODE_ENV === 'development'
            ? console.log
            : false,

        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },

        define: {
            timestamps: true,
            underscored: true
        }
    }
);

module.exports = sequelize;