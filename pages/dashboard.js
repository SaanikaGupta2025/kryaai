import { useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const betaWhitelist = ['approved1@email.com', 'approved2@email.com']; // replace with real ones

export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const email = user?.primaryEmailAddress?.emailAddress;
    if (!isSignedIn || !email || !betaWhitelist.includes(email)) {
      router.replace('/');
    } else {
      setAuthorized(true);
    }
  }, [isLoaded, isSignedIn, user, router]);

  if (!isLoaded || !authorized) return null;

  return (
    <div>
      <h1>Welcome to your secure dashboard</h1>
      {/* your dashboard code here */}
    </div>
  );
}
