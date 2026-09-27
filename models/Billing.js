const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Subscription = sequelize.define(
    'Subscription',
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },

        subscription_id: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true
        },

        msisdn: {
            type: DataTypes.STRING(30),
            allowNull: false,
            index: true
        },

        svc_id: {
            type: DataTypes.STRING(100),
            allowNull: false,
            index: true
        },

        ext_ref: {
            type: DataTypes.STRING(150),
            allowNull: true,
            index: true
        },

        channel: {
            type: DataTypes.STRING(20),
            allowNull: true
        },

        doi_channel: {
            type: DataTypes.STRING(20),
            allowNull: true
        },

        status: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: 'PENDING',
            index: true
        },

        reason: {
            type: DataTypes.STRING(50),
            allowNull: true
        },

        subscription_data: {
            type: DataTypes.JSON,
            allowNull: true
        },

        activated_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        suspended_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        expired_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        cancelled_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    },
    {
        tableName: 'subscriptions'
    }
);

module.exports = Subscription;