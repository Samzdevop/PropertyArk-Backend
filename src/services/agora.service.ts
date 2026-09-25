import { RtmTokenBuilder, RtcTokenBuilder, } from 'agora-token';
import axios from 'axios';
import Logger from '../config/logger';
import { BadRequestError } from '../errors/BadRequestError';

export class AgoraService {
  private static readonly APP_ID = process.env.AGORA_APP_ID!;
  private static readonly APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE!;
  private static readonly ORG_NAME = process.env.AGORA_ORG_NAME!;
  private static readonly APP_NAME = process.env.AGORA_APP_NAME!;
  private static readonly REST_API_URL = `https://a41.chat.agora.io/${this.ORG_NAME}/${this.APP_NAME}`;

  // Generate Agora Chat token for a user
  static generateChatToken(agoraUserId: string, expirationSeconds: number = 86400): string {
    try {
      const token = RtmTokenBuilder.buildToken(
        this.APP_ID,
        this.APP_CERTIFICATE,
        agoraUserId,
        expirationSeconds
      );
      return token;
    } catch (error: any) {
      Logger.error(`Failed to generate Agora token: ${error.message}`);
      throw new BadRequestError('Failed to generate chat token');
    }
  }

  //  Generate Agora RTC token for voice/video calls
  static generateRTCToken(
    channelName: string,
    agoraUserId: string,
    role: 'publisher' | 'subscriber' = 'publisher',
    expirationSeconds: number = 3600
  ): string {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationSeconds;
      
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.APP_ID,
        this.APP_CERTIFICATE,
        channelName,
        0, // UID 0 for string user account
        role === 'publisher' ? 1 : 2, // Role: 1 = publisher, 2 = subscriber
        privilegeExpiredTs,
        privilegeExpiredTs
      );
      return token;
    } catch (error: any) {
      Logger.error(`Failed to generate RTC token: ${error.message}`);
      throw new BadRequestError('Failed to generate RTC token');
    }
  }

  // Get App Token for REST API calls
  private static async getAppToken(): Promise<string> {
    try {
      // App token is valid for 24 hours
      const expirationSeconds = 86400;
      const token = RtmTokenBuilder.buildToken(
        this.APP_ID,
        this.APP_CERTIFICATE,
        'admin', // admin user for app-level operations
        expirationSeconds
      );
      return token;
    } catch (error: any) {
      Logger.error(`Failed to generate app token: ${error.message}`);
      throw new BadRequestError('Failed to generate app token');
    }
  }

  // Register user in Agora Chat
  static async registerUser(agoraUserId: string, nickname?: string): Promise<any> {
    try {
      const appToken = await this.getAppToken();
      
      const response = await axios.post(
        `${this.REST_API_URL}/users`,
        {
          username: agoraUserId,
          password: 'auto-generated-password',
          nickname: nickname || agoraUserId
        },
        {
          headers: {
            'Authorization': `Bearer ${appToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      Logger.info(`Agora user registered: ${agoraUserId}`);
      return response.data;
    } catch (error: any) {
      // If user already exists, that's fine
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
        Logger.info(`Agora user already exists: ${agoraUserId}`);
        return { username: agoraUserId, existing: true };
      }
      
      Logger.error('Failed to register Agora user:', error.response?.data || error.message);
      // Don't throw - users might already exist
      return { username: agoraUserId, error: error.message };
    }
  }

  //Send system message via Agora
  static async sendSystemMessage(from: string, to: string, content: string): Promise<any> {
    try {
      const appToken = await this.getAppToken();
      
      const response = await axios.post(
        `${this.REST_API_URL}/messages/users`,
        {
          from: from,
          to: [to],
          type: 'txt',
          body: { msg: content },
          ext: {
            type: 'system',
            timestamp: Date.now()
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${appToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      Logger.error('Failed to send Agora system message:', error.response?.data || error.message);
      return null;
    }
  }

  // Get user's status (online/offline)

  static async getUserStatus(agoraUserId: string): Promise<any> {
    try {
      const appToken = await this.getAppToken();
      
      const response = await axios.get(
        `${this.REST_API_URL}/users/${agoraUserId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${appToken}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      Logger.error('Failed to get Agora user status:', error.response?.data || error.message);
      return { online: false };
    }
  }

  // Create a chat group/channel
  static async createChatGroup(
    groupName: string,
    owner: string,
    members: string[]
  ): Promise<any> {
    try {
      const appToken = await this.getAppToken();
      
      const response = await axios.post(
        `${this.REST_API_URL}/chatgroups`,
        {
          groupname: groupName,
          desc: `Chat group for ${groupName}`,
          public: false,
          approval: false,
          owner: owner,
          members: members
        },
        {
          headers: {
            'Authorization': `Bearer ${appToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      Logger.info(`Agora chat group created: ${groupName}`);
      return response.data;
    } catch (error: any) {
      Logger.error('Failed to create Agora chat group:', error.response?.data || error.message);
      throw new BadRequestError('Failed to create chat group');
    }
  }

  // Add members to chat group
  static async addGroupMembers(groupId: string, members: string[]): Promise<any> {
    try {
      const appToken = await this.getAppToken();
      
      const response = await axios.post(
        `${this.REST_API_URL}/chatgroups/${groupId}/users`,
        { usernames: members },
        {
          headers: {
            'Authorization': `Bearer ${appToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      Logger.error('Failed to add group members:', error.response?.data || error.message);
      throw new BadRequestError('Failed to add group members');
    }
  }

//  Remove members from chat group

  static async removeGroupMembers(groupId: string, members: string[]): Promise<any> {
    try {
      const appToken = await this.getAppToken();
      
      const response = await axios.delete(
        `${this.REST_API_URL}/chatgroups/${groupId}/users`,
        {
          data: { usernames: members },
          headers: {
            'Authorization': `Bearer ${appToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      Logger.error('Failed to remove group members:', error.response?.data || error.message);
      throw new BadRequestError('Failed to remove group members');
    }
  }
}