"use client";

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

export default function TermsOfServicePage() {
    return (
        <article className="mx-auto max-w-[760px] px-4 pb-20 pt-7 text-[15px] leading-[1.7] text-subtle md:px-8">
            <header className="pb-8">
                <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                    Terms of Service
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    Last updated <span className="tabular-nums">{new Date().toLocaleDateString()}</span>
                </p>
            </header>

            <div className="space-y-9 [&_h2]:text-foreground [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground">
                <Section title="Acceptance of terms">
                    <p>
                        By accessing and using Vexilo, you accept and agree to be bound by the terms and provision of this agreement.
                        If you do not agree to abide by the above, please do not use this service.
                    </p>
                </Section>

                <Section title="User accounts and privacy">
                    <Sub title="Account information">
                        <p>
                            You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
                        </p>
                    </Sub>
                    <Sub title="Public display consent">
                        <p>
                            By using Vexilo, you agree that your username and profile picture may be displayed publicly on our leaderboards,
                            community features, and other public areas of the platform. This includes but is not limited to:
                        </p>
                        <ul>
                            <li>Community leaderboards showing top contributors</li>
                            <li>Public flag submissions with attribution</li>
                            <li>Community engagement features</li>
                            <li>Platform promotional materials (with appropriate context)</li>
                        </ul>
                    </Sub>
                    <Sub title="Privacy controls">
                        <p>
                            You can manage your privacy settings in your account settings page, including options to update your display name
                            and control your visibility in public features.
                        </p>
                    </Sub>
                </Section>

                <Section title="Content guidelines">
                    <Sub title="User-generated content">
                        <p>
                            You retain ownership of content you submit to Vexilo, but you grant us a license to use, display, and distribute
                            your content in connection with the service.
                        </p>
                    </Sub>
                    <Sub title="Prohibited content">
                        <p>
                            You agree not to submit content that is illegal, harmful, threatening, abusive, defamatory, or violates any
                            third-party rights. We reserve the right to remove content that violates these terms.
                        </p>
                    </Sub>
                    <Sub title="Copyright and attribution">
                        <p>
                            You must have the right to share any flag images you submit. Proper attribution must be provided for all content
                            that is not your original work.
                        </p>
                    </Sub>
                </Section>

                <Section title="Service limitations">
                    <Sub title="Service availability">
                        <p>
                            We strive to maintain service availability but cannot guarantee uninterrupted access. We may modify, suspend,
                            or discontinue the service at any time.
                        </p>
                    </Sub>
                    <Sub title="Limitation of liability">
                        <p>
                            Vexilo is provided &quot;as is&quot; without warranties. We are not liable for any damages arising from your use of the service.
                        </p>
                    </Sub>
                    <Sub title="Termination">
                        <p>
                            We may terminate or suspend your account at any time for violations of these terms. You may also terminate
                            your account at any time through your settings.
                        </p>
                    </Sub>
                </Section>

                <Section title="Changes to terms">
                    <p>
                        We may update these terms from time to time. We will notify users of significant changes via email or through
                        the platform. Continued use of the service after changes constitutes acceptance of the new terms.
                    </p>
                </Section>
            </div>
        </article>
    );
}
