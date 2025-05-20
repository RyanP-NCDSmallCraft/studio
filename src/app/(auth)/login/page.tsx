
import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sailboat } from "lucide-react"; // Using Sailboat as a thematic icon

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary via-primary/80 to-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Sailboat className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">RegoCraft</CardTitle>
          <CardDescription>Sign in to manage craft registrations and inspections.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need assistance? Contact{' '}
            <a href="mailto:admin@ncdsmallcraft.com" className="font-medium text-primary hover:underline">
              admin@ncdsmallcraft.com
            </a>
          </p>
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-primary-foreground/70">
        <p>&copy; {new Date().getFullYear()} RegoCraft. All rights reserved.</p>
      </footer>
    </main>
  );
}
