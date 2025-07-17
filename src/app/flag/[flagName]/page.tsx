import { getFlagFromName } from "@/actions/flags";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Flag, Star, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import FlagActions from "./FlagActions";
import FlagCard from "@/components/FlagCard";
import { Metadata } from "next";

export type RelatedFlag = {
    name: string;
    image: string;
    link: string;
};

type Props = {
    params: Promise<{ flagName: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const flagName = decodeURIComponent((await params).flagName);
  const flag = await getFlagFromName(flagName);
  if (flag) {
      return {
          title: `${flag.name} - Vexilo`,
          description: flag.description,
          keywords: [
              flag.name,
              ...flag.tags,
              "Vexilo",
              "Flags",
              "World Flags",
              "Flag Collection",
              "Flag Search",
              "Flag Collection",
          ],
      };
  }

  return {
      title: "Flag Not Found - Vexilo",
      description:
          "The flag you're looking for doesn't exist. Please check the flag name and try again.",
      keywords: [
          "Vexilo",
          "Flags",
          "World Flags",
          "Flag Collection",
          "Flag Search",
      ],
  };
}

export default async function FlagPage({
    params,
}: {
    params: Promise<{ flagName: string }>;
}) {
    const { flagName: flagNameRaw } = await params;
    const flagName = decodeURIComponent(flagNameRaw);
    const flag = await getFlagFromName(flagName);

    if (!flag) {
        notFound();
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="text-center space-y-4 mb-8">
                <Badge variant="neutral" className="mb-2">
                    <Flag className="w-4 h-4 mr-1" />
                    Flag #{flag.index}
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    {flag.name}
                </h1>
                {/* Tags before description */}
                {flag.tags && flag.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center mb-2">
                        {flag.tags.map((tag: string) => (
                            <Badge key={tag} variant="neutral">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}
                {flag.description && (
                    <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                        {flag.description}
                    </p>
                )}
            </div>

            {/* Actions - positioned prominently below header */}
            <div className="flex justify-center mb-8">
                <FlagActions
                    flag={{
                        ...flag,
                        relatedFlags: flag.relatedFlags?.map((flag) => ({
                            id: flag.id,
                            name: flag.name,
                            image: flag.image,
                        })),
                    }}
                />
            </div>

            {/* Flag Display - Full Width */}
            <Card className="mb-8">
                <CardContent className="p-6">
                    <div className="relative aspect-[3/2] md:w-3/4 mx-auto w-full rounded-lg overflow-hidden">
                        <Image
                            src={flag.image}
                            alt={flag.name}
                            fill
                            className="object-contain"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* View Options */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="text-center flex items-center justify-center gap-2">
                        <Eye className="w-5 h-5" />
                        View Options
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid sm:grid-cols-3 gap-4">
                        <Button asChild size="lg">
                            <Link
                                href={flag.link}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Source
                            </Link>
                        </Button>
                        <Button asChild variant="neutral" size="lg">
                            <Link
                                href={flag.image}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Full Size Image
                            </Link>
                        </Button>
                        <Button asChild variant="neutral" size="lg">
                            <Link
                                href={`https://krikienoid.github.io/flagwaver/#?src=${encodeURIComponent(
                                    flag.image
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Flag className="w-4 h-4 mr-2" />
                                Flag Waver
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Related Flags */}
            {flag.relatedFlags && flag.relatedFlags.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Star className="w-5 h-5" />
                            Related Flags
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {flag.relatedFlags.map((relatedFlag) => (
                                <FlagCard
                                    key={relatedFlag.id}
                                    id={relatedFlag.id}
                                    flagName={relatedFlag.name}
                                    flagImage={relatedFlag.image}
                                    favorites={relatedFlag.favorites}
                                    isFavorite={relatedFlag.isFavorite}
                                    link={relatedFlag.link}
                                    index={relatedFlag.index}
                                    tags={relatedFlag.tags}
                                    description={relatedFlag.description}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
