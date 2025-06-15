import { SignInButton, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const betaWhitelist = [
  'approved1@email.com',
  'approved2@email.com',
  // Add more approved emails here
];

export default function Home() {
  const { user, isSignedIn, isLoaded } = useUser(); // <-- add isLoaded
  const router = useRouter();
  const [notApproved, setNotApproved] = useState(false);

  useEffect(() => {
    if (!isLoaded) return; // <-- wait for Clerk to load

    if (isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      if (email && betaWhitelist.includes(email)) {
        router.push('/dashboard');
      } else if (email) {
        setNotApproved(true);
      }
    }
  }, [isSignedIn, user, isLoaded, router]); // <-- include isLoaded
}