import { NextResponse } from 'next/server';
import { appwrite } from '@/lib/appwrite';

export async function POST(req: Request) {
  try {
    const { userId, email, name } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
      // Check if user already exists in Appwrite Auth
      const existingUser = await appwrite.users.get(userId);
      return NextResponse.json({
        success: true,
        message: 'User already exists in Appwrite Auth',
        user: existingUser
      });
    } catch (e: any) {
      // Appwrite throws a 404 error if the user ID does not exist in Auth
      if (e.code === 404 || e.status === 404 || String(e).includes('not found')) {
        console.log(`[Appwrite Auth Sync] User ${userId} not found in Appwrite. Creating account...`);
        
        // Generate a random high-entropy temp password. They authenticate via Clerk,
        // so they will not use this password, but Appwrite requires one for email signup.
        const tempPassword = Math.random().toString(36).substring(2, 15) + 
                             Math.random().toString(36).substring(2, 15) + 
                             "A1!";
        
        const newUser = await appwrite.users.create(
          userId,
          email || undefined,
          undefined,
          tempPassword,
          name || undefined
        );
        
        return NextResponse.json({
          success: true,
          message: 'User successfully synced to Appwrite Auth',
          user: newUser
        });
      }
      throw e;
    }
  } catch (error: any) {
    console.error('[Appwrite Auth Sync Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
