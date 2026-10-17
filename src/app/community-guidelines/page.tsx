import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="border-t border-line pt-7">
            <h2 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h2>
            <div className="mt-3 space-y-5">{children}</div>
        </section>
    );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <div className="mt-1.5 space-y-3">{children}</div>
        </div>
    );
}

/** A list item with a bold lead-in followed by its explanation. */
function Item({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <li>
            <span className="font-medium text-foreground">{title}.</span> {children}
        </li>
    );
}

export default function CommunityGuidelinesPage() {
    return (
        <article className="mx-auto max-w-[760px] px-4 pb-20 pt-7 text-[15px] leading-[1.7] text-subtle md:px-8">
            <header className="pb-8">
                <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                    Community Guidelines
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    How to contribute to Vexilo and what is not allowed.
                </p>
            </header>

            <div className="space-y-9 [&_h2]:text-foreground [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground">
                <Section title="Our mission">
                    <p>
                        Vexilo is a platform for flag enthusiasts to share, discover, and learn about flags from around the world.
                        We believe in fostering a respectful environment where everyone can contribute meaningfully to our shared passion.
                    </p>
                </Section>

                <Section title="What we encourage">
                    <ul>
                        <Item title="High-quality flag images">Clear, well-lit photos or vector graphics.</Item>
                        <Item title="Accurate information">Proper flag names, countries, and historical context.</Item>
                        <Item title="Educational content">Share interesting facts and flag history.</Item>
                        <Item title="Respectful discussions">Engage in constructive conversations about flags.</Item>
                    </ul>
                </Section>

                <Section title="What we don't allow">
                    <ul>
                        <Item title="Offensive or inappropriate content">No hate speech, discrimination, or harmful material.</Item>
                        <Item title="Copyright violations">Only share images you have permission to use.</Item>
                        <Item title="Spam or self-promotion">No excessive posting or commercial content.</Item>
                        <Item title="Misinformation">Ensure all flag information is accurate.</Item>
                    </ul>
                </Section>

                <Section title="Flag submission guidelines">
                    <Sub title="Image requirements">
                        <ul>
                            <li>High resolution (minimum 300×200 pixels)</li>
                            <li>Clear, unobstructed view of the flag</li>
                            <li>Proper aspect ratio and proportions</li>
                            <li>SVG format preferred for crisp scaling</li>
                        </ul>
                    </Sub>
                    <Sub title="Content requirements">
                        <ul>
                            <li>Accurate flag name and country/region</li>
                            <li>Proper source attribution</li>
                            <li>Relevant tags for easy discovery</li>
                            <li>Brief description or historical context</li>
                        </ul>
                    </Sub>
                </Section>

                <Section title="Leaderboard participation">
                    <p>
                        When you post a flag, you may appear on our community leaderboard, which displays your username and profile picture.
                        This helps showcase active contributors and celebrate our community members.
                    </p>
                    <p>
                        You can change your display name at any time on the{" "}
                        <Link
                            href="/settings"
                            className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                        >
                            settings page
                        </Link>
                        .
                    </p>
                </Section>

                <Section title="Community standards">
                    <Sub title="Be respectful">
                        <p>
                            Remember that flags represent nations, regions, and communities. Treat all flags and their cultural significance with respect, even if they&apos;re not from your own background.
                        </p>
                    </Sub>
                    <Sub title="Be accurate">
                        <p>
                            Double-check your information before posting. If you&apos;re unsure about a flag&apos;s details, do your research or ask the community for help.
                        </p>
                    </Sub>
                    <Sub title="Be helpful">
                        <p>
                            Share your knowledge and help others learn. If you see incorrect information, politely correct it with reliable sources.
                        </p>
                    </Sub>
                </Section>
            </div>
        </article>
    );
}
