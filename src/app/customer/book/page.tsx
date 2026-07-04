import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingForm } from "./BookingForm";

export const metadata: Metadata = {
  title: "Book a service",
};

export default function BookPage() {
  return (
    <Suspense>
      <BookingForm />
    </Suspense>
  );
}
