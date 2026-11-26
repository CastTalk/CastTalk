import { SignUp } from '@clerk/nextjs';
import AuthShell, { clerkAppearance } from '@/components/home/AuthShell';

export default function SignUpPage() {
  return (
    <AuthShell title="Talking shouldn't be hard." subtitle="Create your CastTalk account and start a call in seconds.">
      <SignUp appearance={clerkAppearance} />
    </AuthShell>
  );
}
