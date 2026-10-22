"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgoraService = void 0;
const agora_token_1 = require("agora-token");
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../config/logger"));
const BadRequestError_1 = require("../errors/BadRequestError");
class AgoraService {
    static APP_ID = process.env.AGORA_APP_ID;
    static APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
    static ORG_NAME = process.env.AGORA_ORG_NAME;
    static APP_NAME = process.env.AGORA_APP_NAME;
    static REST_API_URL = `https://a41.chat.agora.io/${this.ORG_NAME}/${this.APP_NAME}`;
    // Generate Agora Chat token for a user
    static generateChatToken(agoraUserId, expirationSeconds = 86400) {
        try {
            const token = agora_token_1.RtmTokenBuilder.buildToken(this.APP_ID, this.APP_CERTIFICATE, agoraUserId, expirationSeconds);
            return token;
        }
        catch (error) {
            logger_1.default.error(`Failed to generate Agora token: ${error.message}`);
            throw new BadRequestError_1.BadRequestError('Failed to generate chat token');
        }
    }
    //  Generate Agora RTC token for voice/video calls
    static generateRTCToken(channelName, agoraUserId, role = 'publisher', expirationSeconds = 3600) {
        try {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const privilegeExpiredTs = currentTimestamp + expirationSeconds;
            const token = agora_token_1.RtcTokenBuilder.buildTokenWithUid(this.APP_ID, this.APP_CERTIFICATE, channelName, 0, // UID 0 for string user account
            role === 'publisher' ? 1 : 2, // Role: 1 = publisher, 2 = subscriber
            privilegeExpiredTs, privilegeExpiredTs);
            return token;
        }
        catch (error) {
            logger_1.default.error(`Failed to generate RTC token: ${error.message}`);
            throw new BadRequestError_1.BadRequestError('Failed to generate RTC token');
        }
    }
    // Get App Token for REST API calls
    static async getAppToken() {
        try {
            // App token is valid for 24 hours
            const expirationSeconds = 86400;
            const token = agora_token_1.RtmTokenBuilder.buildToken(this.APP_ID, this.APP_CERTIFICATE, 'admin', // admin user for app-level operations
            expirationSeconds);
            return token;
        }
        catch (error) {
            logger_1.default.error(`Failed to generate app token: ${error.message}`);
            throw new BadRequestError_1.BadRequestError('Failed to generate app token');
        }
    }
    // Register user in Agora Chat
    static async registerUser(agoraUserId, nickname) {
        try {
            const appToken = await this.getAppToken();
            const response = await axios_1.default.post(`${this.REST_API_URL}/users`, {
                username: agoraUserId,
                password: 'auto-generated-password',
                nickname: nickname || agoraUserId
            }, {
                headers: {
                    'Authorization': `Bearer ${appToken}`,
                    'Content-Type': 'application/json'
                }
            });
            logger_1.default.info(`Agora user registered: ${agoraUserId}`);
            return response.data;
        }
        catch (error) {
            // If user already exists, that's fine
            if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
                logger_1.default.info(`Agora user already exists: ${agoraUserId}`);
                return { username: agoraUserId, existing: true };
            }
            logger_1.default.error('Failed to register Agora user:', error.response?.data || error.message);
            // Don't throw - users might already exist
            return { username: agoraUserId, error: error.message };
        }
    }
    //Send system message via Agora
    static async sendSystemMessage(from, to, content) {
        try {
            const appToken = await this.getAppToken();
            const response = await axios_1.default.post(`${this.REST_API_URL}/messages/users`, {
                from: from,
                to: [to],
                type: 'txt',
                body: { msg: content },
                ext: {
                    type: 'system',
                    timestamp: Date.now()
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${appToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to send Agora system message:', error.response?.data || error.message);
            return null;
        }
    }
    // Get user's status (online/offline)
    static async getUserStatus(agoraUserId) {
        try {
            const appToken = await this.getAppToken();
            const response = await axios_1.default.get(`${this.REST_API_URL}/users/${agoraUserId}/status`, {
                headers: {
                    'Authorization': `Bearer ${appToken}`
                }
            });
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to get Agora user status:', error.response?.data || error.message);
            return { online: false };
        }
    }
    // Create a chat group/channel
    static async createChatGroup(groupName, owner, members) {
        try {
            const appToken = await this.getAppToken();
            const response = await axios_1.default.post(`${this.REST_API_URL}/chatgroups`, {
                groupname: groupName,
                desc: `Chat group for ${groupName}`,
                public: false,
                approval: false,
                owner: owner,
                members: members
            }, {
                headers: {
                    'Authorization': `Bearer ${appToken}`,
                    'Content-Type': 'application/json'
                }
            });
            logger_1.default.info(`Agora chat group created: ${groupName}`);
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to create Agora chat group:', error.response?.data || error.message);
            throw new BadRequestError_1.BadRequestError('Failed to create chat group');
        }
    }
    // Add members to chat group
    static async addGroupMembers(groupId, members) {
        try {
            const appToken = await this.getAppToken();
            const response = await axios_1.default.post(`${this.REST_API_URL}/chatgroups/${groupId}/users`, { usernames: members }, {
                headers: {
                    'Authorization': `Bearer ${appToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to add group members:', error.response?.data || error.message);
            throw new BadRequestError_1.BadRequestError('Failed to add group members');
        }
    }
    //  Remove members from chat group
    static async removeGroupMembers(groupId, members) {
        try {
            const appToken = await this.getAppToken();
            const response = await axios_1.default.delete(`${this.REST_API_URL}/chatgroups/${groupId}/users`, {
                data: { usernames: members },
                headers: {
                    'Authorization': `Bearer ${appToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to remove group members:', error.response?.data || error.message);
            throw new BadRequestError_1.BadRequestError('Failed to remove group members');
        }
    }
}
exports.AgoraService = AgoraService;
