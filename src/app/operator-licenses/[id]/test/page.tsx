
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { CommercialLicense, CompetencyTest, CompetencyTestAnswer, CompetencyTestTemplateQuestion, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ListChecks, Send, Loader2 } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { Timestamp, doc, collection, addDoc, updateDoc, DocumentReference, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatFirebaseTimestamp } from '@/lib/utils';

const sampleQuestions: Array<CompetencyTestTemplateQuestion & { actualCorrectAnswer: string | boolean }> = [
  { questionId: "SQ001", questionText: "It is safe to operate a small craft at high speed near swimmers or other boats.", questionType: "TrueFalse", actualCorrectAnswer: false, points: 1 },
  { questionId: "SQ002", questionText: "What is the primary purpose of a lifejacket?", questionType: "MultipleChoice", options: ["To keep you warm", "To keep you afloat", "To make you swim faster"], actualCorrectAnswer: "To keep you afloat", points: 1 },
  { questionId: "SQ003", questionText: "If your engine breaks down, you should immediately jump overboard and swim for shore.", questionType: "TrueFalse", actualCorrectAnswer: false, points: 1 },
  { questionId: "SQ004", questionText: "Before starting your voyage, you should always check:", questionType: "MultipleChoice", options: ["The weather forecast", "Fuel levels", "Safety equipment", "All of the above"], actualCorrectAnswer: "All of the above", points: 1 },
  { questionId: "SQ005", questionText: "In Papua New Guinea, on which side should you generally pass an oncoming vessel when meeting head-on (assuming both are power-driven)?", questionType: "MultipleChoice", options: ["Port (your left)", "Starboard (your right)", "Either side is fine"], actualCorrectAnswer: "Starboard (your right)", points: 1 },
];

const testSubmissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    answerGiven: z.string().min(1, "Please select an answer."),
  })).min(sampleQuestions.length, "All questions must be answered.")
});

type TestSubmissionValues = z.infer<typeof testSubmissionSchema>;

export default function TakeCompetencyTestPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const licenseApplicationId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [application, setApplication] = useState<CommercialLicense | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  
  console.log("TakeCompetencyTestPage rendering for ID:", licenseApplicationId);


  const form = useForm<TestSubmissionValues>({
    resolver: zodResolver(testSubmissionSchema),
    defaultValues: {
      answers: sampleQuestions.map(q => ({ questionId: q.questionId, answerGiven: "" })),
    },
  });

  const fetchApplicationDetails = useCallback(async () => {
    if (!licenseApplicationId || !currentUser) {
        setPageError("Application ID or user information is missing.");
        return;
    }
    setIsLoading(true);
    try {
        const appDocRef = doc(db, "operatorLicenseApplications", licenseApplicationId);
        const appSnap = await getDoc(appDocRef);
        if (!appSnap.exists()) {
            setPageError("License application not found.");
            setIsLoading(false);
            return;
        }
        const appData = appSnap.data() as CommercialLicense;
        setApplication(appData);

        if (appData.operatorRef) {
            let opRef: DocumentReference;
            if (typeof appData.operatorRef === 'string') {
                opRef = doc(db, appData.operatorRef);
            } else {
                opRef = appData.operatorRef as DocumentReference;
            }
            const opSnap = await getDoc(opRef);
            if (opSnap.exists()) {
                setOperator(opSnap.data() as Operator);
            } else {
                 setPageError("Operator details not found.");
            }
        }
    } catch (error: any) {
        console.error("Error fetching application details for test:", error);
        setPageError(error.message || "Failed to load application details.");
    }
    setIsLoading(false);
  }, [licenseApplicationId, currentUser]);

  useEffect(() => {
    fetchApplicationDetails();
  }, [fetchApplicationDetails]);


  const onSubmit = async (data: TestSubmissionValues) => {
    if (!currentUser?.userId || !application || !operator) {
      toast({ title: "Error", description: "Missing user, application, or operator data.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    let scoreAchieved = 0;
    const submittedAnswers: CompetencyTestAnswer[] = data.answers.map(formAnswer => {
      const question = sampleQuestions.find(q => q.questionId === formAnswer.questionId);
      let isCorrect = false;
      if (question) {
        if (question.questionType === "TrueFalse") {
          isCorrect = (formAnswer.answerGiven === 'true') === question.actualCorrectAnswer;
        } else {
          isCorrect = formAnswer.answerGiven === question.actualCorrectAnswer;
        }
        if (isCorrect) {
          scoreAchieved += question.points || 0;
        }
      }
      return {
        questionId: formAnswer.questionId,
        answerGiven: formAnswer.answerGiven,
        isCorrect,
        scoreAwarded: isCorrect ? (question?.points || 0) : 0,
      };
    });

    const totalPossibleScore = sampleQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
    const percentageAchieved = totalPossibleScore > 0 ? (scoreAchieved / totalPossibleScore) * 100 : 0;
    const result: CompetencyTest["result"] = percentageAchieved >= 60 ? "Pass" : "Fail"; // Assuming 60% pass mark

    const competencyTestPayload: Omit<CompetencyTest, 'testId'> = {
      licenseApplicationRef: doc(db, "operatorLicenseApplications", licenseApplicationId) as DocumentReference<CommercialLicense>,
      operatorRef: application.operatorRef as DocumentReference<Operator>, // Assuming operatorRef is DocumentReference by now
      testTemplateRef: doc(db, "competencyTestTemplates", "SAMPLE_V1") as DocumentReference<any>, // Placeholder
      testTemplateVersion: 1,
      testDate: Timestamp.now(),
      examinerRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
      scoreAchieved,
      percentageAchieved,
      result,
      answers: submittedAnswers,
      createdAt: Timestamp.now(),
    };

    try {
      const testDocRef = await addDoc(collection(db, "competencyTests"), competencyTestPayload);
      await updateDoc(doc(db, "operatorLicenseApplications", licenseApplicationId), {
        status: result === "Pass" ? "TestPassed" : "TestFailed",
        competencyTestRef: testDocRef,
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
      });

      toast({ title: "Test Submitted", description: `Result: ${result} (${percentageAchieved.toFixed(0)}%)` });
      router.push(`/commercial-licenses/${licenseApplicationId}`);
      router.refresh();
    } catch (error: any) {
      console.error("Error saving competency test:", error);
      toast({ title: "Submission Failed", description: error.message || "Could not save test results.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !application) {
    return <div className="flex h-64 justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading test setup...</p></div>;
  }
  if (pageError) {
    return <div className="text-center py-10 text-destructive">Error: {pageError}</div>;
  }
  if (!application || !operator) {
    return <div className="text-center py-10 text-muted-foreground">Application or operator details could not be loaded.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <ListChecks className="h-8 w-8 text-primary" />
        <div>
            <h1 className="text-3xl font-bold">Operator Competency Test</h1>
            <p className="text-sm text-muted-foreground">For: {operator.firstName} {operator.surname} (App ID: {licenseApplicationId})</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {sampleQuestions.map((question, index) => (
            <Card key={question.questionId}>
              <CardHeader>
                <CardTitle className="text-lg">Question {index + 1}:</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3">{question.questionText}</p>
                <FormField
                  control={form.control}
                  name={`answers.${index}.answerGiven`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                          {question.questionType === "TrueFalse" ? (
                            <>
                              <FormItem className="flex items-center space-x-3">
                                <FormControl><RadioGroupItem value="true" id={`${question.questionId}-true`} /></FormControl>
                                <FormLabel htmlFor={`${question.questionId}-true`} className="font-normal">True</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3">
                                <FormControl><RadioGroupItem value="false" id={`${question.questionId}-false`} /></FormControl>
                                <FormLabel htmlFor={`${question.questionId}-false`} className="font-normal">False</FormLabel>
                              </FormItem>
                            </>
                          ) : question.options?.map(option => (
                            <FormItem key={option} className="flex items-center space-x-3">
                              <FormControl><RadioGroupItem value={option} id={`${question.questionId}-${option.replace(/\s+/g, '')}`} /></FormControl>
                              <FormLabel htmlFor={`${question.questionId}-${option.replace(/\s+/g, '')}`} className="font-normal">{option}</FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          ))}
          <CardFooter className="flex justify-end gap-4 p-0 pt-8">
            <Button type="submit" disabled={isLoading || form.formState.isSubmitting}>
              {isLoading || form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit Test
            </Button>
          </CardFooter>
        </form>
      </Form>
    </div>
  );
}
