const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CallbackEvent = sequelize.define(
    'CallbackEvent',
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        event_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            index: true
        },

        reason: {
            type: DataTypes.STRING(50),
            allowNull: true,
            index: true
        },

        subscription_id: {
            type: DataTypes.STRING(100),
            allowNull: true,
            index: true
        },

        billing_ref: {
            type: DataTypes.STRING(150),
            allowNull: true,
            index: true
        },

        msisdn: {
            type: DataTypes.STRING(30),
            allowNull: true
        },

        payload: {
            type: DataTypes.JSON,
            allowNull: false
        },

        processed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

        processed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        error_message: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    },
    {
        tableName: 'callback_events'
    }
);

module.exports = CallbackEvent;