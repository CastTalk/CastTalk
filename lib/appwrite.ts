import { Client, Databases, Users } from 'node-appwrite';

const createAdminClient = () => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://syd.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID || '6a27f0d9002671523088')
    .setKey(process.env.APPWRITE_SECRET || '');

  return {
    get databases() {
      return new Databases(client);
    },
    get users() {
      return new Users(client);
    }
  };
};

export const appwrite = createAdminClient();
