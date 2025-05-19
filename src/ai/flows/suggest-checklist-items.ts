// src/ai/flows/suggest-checklist-items.ts
'use server';
/**
 * @fileOverview AI-powered checklist item suggestion flow for inspections.
 *
 * - suggestChecklistItems - A function that suggests relevant checklist items based on craft details and registration history.
 * - SuggestChecklistItemsInput - The input type for the suggestChecklistItems function.
 * - SuggestChecklistItemsOutput - The return type for the suggestChecklistItems function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestChecklistItemsInputSchema = z.object({
  craftMake: z.string().describe('The make of the craft.'),
  craftModel: z.string().describe('The model of the craft.'),
  craftYear: z.number().describe('The year the craft was made.'),
  craftType: z.string().describe('The type of the craft (e.g., OpenBoat, CabinCruiser).'),
  registrationHistory: z
    .string()
    .describe('A summary of the craft registration history.'),
});
export type SuggestChecklistItemsInput = z.infer<typeof SuggestChecklistItemsInputSchema>;

const SuggestChecklistItemsOutputSchema = z.array(z.string()).describe('An array of suggested checklist item descriptions.');
export type SuggestChecklistItemsOutput = z.infer<typeof SuggestChecklistItemsOutputSchema>;

export async function suggestChecklistItems(input: SuggestChecklistItemsInput): Promise<SuggestChecklistItemsOutput> {
  return suggestChecklistItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestChecklistItemsPrompt',
  input: {schema: SuggestChecklistItemsInputSchema},
  output: {schema: SuggestChecklistItemsOutputSchema},
  prompt: `You are an expert marine safety inspector. Based on the following information about a craft, suggest a list of checklist items that should be included in a safety inspection. Be as comprehensive as possible.

Craft Make: {{{craftMake}}}
Craft Model: {{{craftModel}}}
Craft Year: {{{craftYear}}}
Craft Type: {{{craftType}}}
Registration History: {{{registrationHistory}}}

Suggest a list of checklist items (just the descriptions) relevant for inspecting this craft. Respond as a JSON array of strings. Do not include any additional text.`,
});

const suggestChecklistItemsFlow = ai.defineFlow(
  {
    name: 'suggestChecklistItemsFlow',
    inputSchema: SuggestChecklistItemsInputSchema,
    outputSchema: SuggestChecklistItemsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
