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

        // Telkom PartnerHUB subscription ID
        subscription_id: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true
        },

        // Customer mobile number
        msisdn: {
            type: DataTypes.STRING(30),
            allowNull: false,
            index: true
        },

        // Telkom service ID
        svc_id: {
            type: DataTypes.STRING(100),
            allowNull: false,
            index: true
        },

        // Your application/order reference
        ext_ref: {
            type: DataTypes.STRING(150),
            allowNull: true,
            index: true
        },

        // WAP / SMS
        channel: {
            type: DataTypes.ENUM(
                'WAP',
                'SMS'
            ),
            allowNull: true
        },

        // DOI channel
        doi_channel: {
            type: DataTypes.ENUM(
                'WAP',
                'SMS'
            ),
            allowNull: true
        },

        // Local subscription status
        status: {
            type: DataTypes.ENUM(
                'PENDING',
                'ACTIVE',
                'SUSPENDED',
                'EXPIRED',
                'CANCELLED',
                'DOI_FAILED',
                'FAILED'
            ),
            allowNull: false,
            defaultValue: 'PENDING',
            index: true
        },

        // Telkom callback reason
        reason: {
            type: DataTypes.STRING(50),
            allowNull: true,
            index: true
        },

        // Complete response received from Telkom
        subscription_data: {
            type: DataTypes.JSON,
            allowNull: true
        },

        // WAP DOI URL if Telkom returns it
        consent_url: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        // Dates based on Telkom callback events
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
        },

        doi_failed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        // Last callback received
        last_callback_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    },

    {
        tableName: 'subscriptions',

        timestamps: true,

        createdAt: 'created_at',
        updatedAt: 'updated_at',

        indexes: [
            {
                fields: ['msisdn']
            },
            {
                fields: ['svc_id']
            },
            {
                fields: ['status']
            },
            {
                fields: ['ext_ref']
            },
            {
                fields: ['subscription_id']
            }
        ]
    }
);

module.exports = Subscription;