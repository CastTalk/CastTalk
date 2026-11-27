import { SignIn } from '@clerk/nextjs';
import AuthShell, { clerkAppearance } from '@/components/home/AuthShell';

export default function SignInPage() {
  return (
    <AuthShell title="Welcome back." subtitle="Pick up the conversation where you left it.">
      <SignIn appearance={clerkAppearance} />
    </AuthShell>
  );
}
