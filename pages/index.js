import { SignInButton, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const betaWhitelist = [
  'approved1@email.com',
  'approved2@email.com',
  // Add more approved emails here
];

export default function Home() {
  console.log('CLERK KEY (landing page):', process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [notApproved, setNotApproved] = useState(false);

  useEffect(() => {
    if (isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      if (email && betaWhitelist.includes(email)) {
        router.push('/dashboard');
      } else if (email) {
        setNotApproved(true);
      }
    }
  }, [isSignedIn, user, router]);

  return (
    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
      <h1>Welcome to KryaAI</h1>
      <SignInButton mode="modal">
        <button style={{ padding: '1rem 2rem', fontSize: '1.2rem', marginTop: '2rem' }}>
          Join the Beta
        </button>
      </SignInButton>
      {notApproved && (
        <div style={{ marginTop: '2rem', color: 'red', fontWeight: 'bold' }}>
          Thanks for signing up! You'll be notified when you're approved for beta access.
        </div>
      )}
    </div>
  );
} 