import LoginButton from "@/components/LoginButton";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl mb-4">Welcome to Fort Amazing</h1>
      <LoginButton />
    </div>
  );
}

