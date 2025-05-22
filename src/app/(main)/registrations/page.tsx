"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function NewRegistrationForm() {
  const { register, handleSubmit, control, reset } = useForm({
    defaultValues: {
      scaRegoNo: "",
      craftMake: "",
      craftModel: "",
      craftUse: "Pleasure",
      fuelType: "Gasoline",
      owners: [{ firstName: "", surname: "", role: "Primary" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "owners",
  });

  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await addDoc(collection(db, "registrations"), {
        ...data,
        status: "Draft",
        createdAt: serverTimestamp(),
      });
      reset();
      alert("Registration created successfully.");
    } catch (error) {
      console.error("Error adding registration:", error);
      alert("Error submitting form.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Craft Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="scaRegoNo">SCA Registration No.</Label>
            <Input id="scaRegoNo" {...register("scaRegoNo", { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="craftMake">Craft Make</Label>
              <Input id="craftMake" {...register("craftMake", { required: true })} />
            </div>
            <div>
              <Label htmlFor="craftModel">Craft Model</Label>
              <Input id="craftModel" {...register("craftModel", { required: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Craft Use</Label>
              <Select {...register("craftUse")}
                defaultValue="Pleasure">
                <SelectTrigger>
                  <SelectValue placeholder="Select craft use" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pleasure">Pleasure</SelectItem>
                  <SelectItem value="Fishing">Fishing</SelectItem>
                  <SelectItem value="Transport">Transport</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fuel Type</Label>
              <Select {...register("fuelType")}
                defaultValue="Gasoline">
                <SelectTrigger>
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gasoline">Gasoline</SelectItem>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="Electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Owners</h3>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <Label>First Name</Label>
                  <Input {...register(`owners.${index}.firstName`, { required: true })} />
                </div>
                <div>
                  <Label>Surname</Label>
                  <Input {...register(`owners.${index}.surname`, { required: true })} />
                </div>
                <div className="col-span-2">
                  <Button type="button" variant="destructive" onClick={() => remove(index)}>
                    Remove Owner
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" onClick={() => append({ firstName: "", surname: "", role: "Secondary" })}>
              Add Another Owner
            </Button>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit Registration"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}