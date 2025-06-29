"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, Heart } from "lucide-react";
import { useFavoritesStore } from "@/store/favorites";

type Flag = {
    flagName: string;
    flagImage: string;
    link: string;
    index: number;
};

type FlagQuizProps = {
    flags: Flag[];
};

export default function FlagQuiz({ flags }: FlagQuizProps) {
    const [currentQuestion, setCurrentQuestion] = useState<Flag | null>(null);
    const [options, setOptions] = useState<string[]>([]);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [score, setScore] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);

    const { toggleFavorite, isFavorite } = useFavoritesStore();

    const generateQuestion = () => {
        // Pick a random flag
        const randomFlag = flags[Math.floor(Math.random() * flags.length)];

        // Get 3 random wrong answers
        const wrongOptions = flags
            .filter((flag) => flag.flagName !== randomFlag.flagName)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map((flag) => flag.flagName);

        // Combine correct and wrong answers and shuffle
        const allOptions = [randomFlag.flagName, ...wrongOptions];
        const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

        setCurrentQuestion(randomFlag);
        setOptions(shuffledOptions);
        setSelectedAnswer(null);
        setIsCorrect(null);
    };

    const handleAnswerSelect = (answer: string) => {
        if (selectedAnswer !== null) return; // Prevent multiple selections

        setSelectedAnswer(answer);
        const correct = answer === currentQuestion?.flagName;
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

    if (!currentQuestion) {
        return null;
    }

    return (
        <Card className="h-full">
            <CardHeader className="text-center">
                <div className="flex flex-wrap items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Flag Quiz
                    </h2>
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
                <p className="text-gray-600">What does this flag belong to?</p>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Flag Image */}
                <div className="relative aspect-[3/2] w-full max-w-md mx-auto group">
                    <Image
                        src={currentQuestion.flagImage}
                        alt="Quiz flag"
                        fill
                        className="object-contain border rounded-lg"
                        sizes="(max-width: 768px) 100vw, 400px"
                    />
                    {/* Favorite Button */}
                    <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => toggleFavorite(currentQuestion.flagName)}
                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white/90 backdrop-blur-sm"
                    >
                        <Heart
                            className={`w-5 h-5 ${
                                isFavorite(currentQuestion.flagName)
                                    ? "fill-red-500 text-red-500"
                                    : "text-gray-600"
                            }`}
                        />
                    </Button>
                </div>

                {/* Answer Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {options.map((option, index) => (
                        <Button
                            key={index}
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
                            <div className="flex items-center gap-2 w-full">
                                <span className="font-medium">{option}</span>
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
                                : `Incorrect. The correct answer is ${currentQuestion.flagName}.`}
                        </p>
                    </div>
                )}

                {/* Next Question Button */}
                {selectedAnswer && (
                    <div className="text-center">
                        <Button onClick={handleNextQuestion} className="mt-2">
                            Next Question
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
