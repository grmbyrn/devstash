import { auth } from "@/auth";
import { Navbar } from "@/components/site/navbar";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <>
      <Navbar signedIn={Boolean(session?.user)} />
      {/* pt-28 = the h-16 fixed nav + the usual py-12, so the card never sits under it. */}
      <div className="flex min-h-screen items-center justify-center bg-background px-4 pt-28 pb-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </>
  );
}
