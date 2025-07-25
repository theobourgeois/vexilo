"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle, XCircle, Heart, Eye } from "lucide-react";
import { useSession } from "next-auth/react";
import { getRandomFlag } from "@/lib/get-random-flag";
import { toggleFavoriteFlag } from "@/actions/flags";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import FlagDetailsDialog from "./FlagDetailsDialog";
import { useRouter } from "next/navigation";

type Flag = {
	name: string;
	image: string;
	id: string;
	link: string;
	index: number;
};

export default function FlagQuiz() {
	const router = useRouter();
	const [currentQuestion, setCurrentQuestion] = useState<Flag | null>(null);
	const [options, setOptions] = useState<string[]>([]);
	const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
	const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
	const [score, setScore] = useState(0);
	const [totalQuestions, setTotalQuestions] = useState(0);
	const [loading, setLoading] = useState(true);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_, setFavoriteCount] = useState(0);
	const [isFavorite, setIsFavorite] = useState(false);
	const [showFlagDialog, setShowFlagDialog] = useState(false);

	const { data: session } = useSession();
	const queryClient = useQueryClient();

	const handleFavoriteToggle = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!session?.user) {
			toast.error("You must be logged in to favorite a flag");
			return;
		}
		if (!currentQuestion) return;

		if (isFavorite) {
			setFavoriteCount((prev) => prev - 1);
			setIsFavorite(false);
		} else {
			setFavoriteCount((prev) => prev + 1);
			setIsFavorite(true);
		}

		toggleFavoriteFlag(currentQuestion.id).then((isSuccess) => {
			queryClient.invalidateQueries({ queryKey: ["flags"] });
			if (!isSuccess) {
				setFavoriteCount((prev) => prev - 1);
				setIsFavorite(false);
			}
		});
	};

	const generateQuestion = async () => {
		setLoading(true);
		try {
			// Get 4 random flags
			const randomFlags = [
				getRandomFlag(),
				getRandomFlag(),
				getRandomFlag(),
				getRandomFlag(),
			] as unknown as Flag[];
			if (!randomFlags || randomFlags.length < 4) {
				console.error("Not enough flags found");
				return;
			}

			// Pick the first one as the correct answer
			const correctFlag = randomFlags[0];
			const wrongOptions = randomFlags.slice(1).map((flag) => flag.name);

			// Combine correct and wrong answers and shuffle
			const allOptions = [correctFlag.name, ...wrongOptions];
			const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

			setCurrentQuestion(correctFlag);
			setOptions(shuffledOptions);
			setSelectedAnswer(null);
			setIsCorrect(null);
		} catch (error) {
			console.error("Error generating question:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleAnswerSelect = (answer: string) => {
		if (selectedAnswer !== null || !currentQuestion) return; // Prevent multiple selections

		setSelectedAnswer(answer);
		const correct = answer === currentQuestion.name;
		setIsCorrect(correct);

		if (correct) {
			setScore((prev) => prev + 1);
		}
		setTotalQuestions((prev) => prev + 1);
	};

	const handleNextQuestion = () => {
		generateQuestion();
	};

	useEffect(() => {
		generateQuestion();
	}, []);

	if (loading) {
		return (
			<Card className="h-full">
				<CardHeader className="text-center">
					<div className="flex flex-wrap items-center justify-between mb-4">
						<h2 className="text-2xl font-bold ">Flag Quiz</h2>
						<div className="flex items-center gap-2 flex-wrap">
							<Badge variant="neutral">
								Score: {score}/{totalQuestions}
							</Badge>
							<Button
								variant="neutral"
								size="sm"
								onClick={handleNextQuestion}
								className="ml-2"
							>
								<RefreshCw className="w-4 h-4 mr-1" />
								New Question
							</Button>
						</div>
					</div>
					<p className="">Who does this flag belong to?</p>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Flag Image Skeleton */}
					<div className="relative aspect-[3/2] w-full max-w-md mx-auto">
						<Skeleton className="w-full h-full flex items-center justify-center">
							<RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
						</Skeleton>
					</div>

					{/* Answer Options Skeleton */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{[1, 2, 3, 4].map((index) => (
							<Skeleton key={index} className="h-12" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!currentQuestion) {
		return (
			<Card className="h-full">
				<CardContent className="flex items-center justify-center h-64">
					<div className="text-center">
						<p>No flags available for quiz.</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="h-full">
			<CardHeader className="text-center">
				<div className="flex flex-wrap items-center justify-between mb-4">
					<h2 className="text-2xl font-bold ">Flag Quiz</h2>
					<div className="flex items-center gap-2 flex-wrap">
						<Badge variant="neutral">
							Score: {score}/{totalQuestions}
						</Badge>
						<Button
							variant="neutral"
							size="sm"
							onClick={handleNextQuestion}
							className="ml-2"
						>
							<RefreshCw className="w-4 h-4 mr-1" />
							New Question
						</Button>
					</div>
				</div>
				<p className="">Who does this flag belong to?</p>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Flag Image */}
				<div className="relative aspect-[3/2] w-full max-w-md mx-auto group">
					<Image
						src={currentQuestion.image}
						alt="Quiz flag"
						fill
						className="object-contain border rounded-lg"
						sizes="(max-width: 768px) 100vw, 400px"
					/>
					{/* Favorite Button */}
					<Button
						variant="neutral"
						size="sm"
						onClick={handleFavoriteToggle}
						className="absolute top-0 right-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white/90 backdrop-blur-sm"
					>
						<Heart
							className={`w-5 h-5 ${
								isFavorite ? "fill-red-500 text-red-500" : "text-gray-600"
							}`}
						/>
					</Button>
				</div>

				{/* Answer Options */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{options.map((option) => (
						<Button
							key={option}
							variant={
								selectedAnswer === option
									? isCorrect
										? "default"
										: "neutral"
									: "neutral"
							}
							className={`h-12 text-left justify-start px-4 ${
								selectedAnswer === option
									? isCorrect
										? "bg-green-500 hover:bg-green-600 text-white"
										: "bg-red-500 hover:bg-red-600 text-white"
									: ""
							}`}
							onClick={() => handleAnswerSelect(option)}
							disabled={selectedAnswer !== null}
						>
							<div className="flex items-center gap-2 w-full" title={option}>
								<span className="font-medium truncate">{option}</span>
								{selectedAnswer === option && (
									<>
										{isCorrect ? (
											<CheckCircle className="w-4 h-4 ml-auto" />
										) : (
											<XCircle className="w-4 h-4 ml-auto" />
										)}
									</>
								)}
							</div>
						</Button>
					))}
				</div>

				{/* Result Message */}
				{selectedAnswer && (
					<div
						className={`text-center p-4 rounded-lg ${
							isCorrect
								? "bg-green-50 text-green-800 border border-green-200"
								: "bg-red-50 text-red-800 border border-red-200"
						}`}
					>
						<p className="font-medium">
							{isCorrect
								? "Correct! Well done!"
								: `Incorrect. The correct answer is ${currentQuestion.name}.`}
						</p>
					</div>
				)}

				{/* Show Flag and Next Question Buttons */}
				{selectedAnswer && (
					<div className="text-center space-y-2">
						<div className="flex flex-col sm:flex-row gap-2 justify-center">
							<Button
								variant="neutral"
								onClick={() =>
									router.push(
										`/flag/${encodeURIComponent(currentQuestion.name)}`,
									)
								}
								className="flex items-center gap-2"
							>
								<Eye className="w-4 h-4" />
								Show Flag Details
							</Button>
							<Button onClick={handleNextQuestion}>Next Question</Button>
						</div>
					</div>
				)}

				{/* Flag Details Dialog */}
				{currentQuestion && (
					<FlagDetailsDialog
						open={showFlagDialog}
						showEditControls
						onOpenChange={setShowFlagDialog}
						flag={{
							id: currentQuestion.id,
							flagName: currentQuestion.name,
							flagImage: currentQuestion.image,
							link: currentQuestion.link,
							index: currentQuestion.index,
							tags: [],
							description: "",
						}}
					/>
				)}
			</CardContent>
		</Card>
	);
}
