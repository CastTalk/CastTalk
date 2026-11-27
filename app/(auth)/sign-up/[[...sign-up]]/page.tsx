import { SignUp } from '@clerk/nextjs';
import AuthShell, { clerkAppearance } from '@/components/home/AuthShell';

export default function SignUpPage() {
  return (
    <AuthShell title="Better conversations start here." subtitle="Create your CastTalk account and start a call in seconds.">
      <SignUp appearance={clerkAppearance} />
    </AuthShell>
  );
}
