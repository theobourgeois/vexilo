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

export default function PrivacyPolicyPage() {
    return (
        <article className="mx-auto max-w-[760px] px-4 pb-20 pt-7 text-[15px] leading-[1.7] text-subtle md:px-8">
            <header className="pb-8">
                <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                    Privacy Policy
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    Last updated <span className="tabular-nums">{new Date().toLocaleDateString()}</span>
                </p>
            </header>

            <div className="space-y-9 [&_h2]:text-foreground [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground">
                <Section title="Your privacy">
                    <p>
                        At Vexilo, we are committed to protecting your privacy and being transparent about how we collect,
                        use, and share your information. This policy explains our practices regarding your personal data.
                    </p>
                </Section>

                <Section title="Information we collect">
                    <Sub title="Account information">
                        <ul>
                            <li>Email address (for authentication and communication)</li>
                            <li>Display name and profile picture</li>
                            <li>Authentication provider information (Google, etc.)</li>
                            <li>Account preferences and settings</li>
                        </ul>
                    </Sub>
                    <Sub title="Content you submit">
                        <ul>
                            <li>Flag images and descriptions</li>
                            <li>Comments and community interactions</li>
                            <li>User-generated content and metadata</li>
                        </ul>
                    </Sub>
                    <Sub title="Usage information">
                        <ul>
                            <li>Pages visited and features used</li>
                            <li>Search queries and preferences</li>
                            <li>Device and browser information</li>
                            <li>IP address and general location data</li>
                        </ul>
                    </Sub>
                </Section>

                <Section title="How we use your information">
                    <Sub title="Service provision">
                        <p>
                            We use your information to provide, maintain, and improve our flag discovery platform,
                            including user authentication, content management, and community features.
                        </p>
                    </Sub>
                    <Sub title="Public display">
                        <p>Your username and profile picture may be displayed publicly on:</p>
                        <ul>
                            <li>Community leaderboards</li>
                            <li>Flag submission attributions</li>
                            <li>User activity feeds</li>
                            <li>Community engagement features</li>
                        </ul>
                    </Sub>
                    <Sub title="Communication">
                        <p>
                            We may use your email to send important service updates, security notifications,
                            and respond to your inquiries. You can opt out of promotional communications.
                        </p>
                    </Sub>
                    <Sub title="Analytics and improvement">
                        <p>
                            We analyze usage patterns to improve our service, develop new features,
                            and ensure platform security and performance.
                        </p>
                    </Sub>
                </Section>

                <Section title="Information sharing">
                    <Sub title="Public information">
                        <p>
                            Your username, profile picture, and submitted content are publicly visible
                            to other users of the platform as part of the community experience.
                        </p>
                    </Sub>
                    <Sub title="Service providers">
                        <p>
                            We may share information with trusted third-party service providers who help us
                            operate our platform (hosting, analytics, authentication, etc.).
                        </p>
                    </Sub>
                    <Sub title="Legal requirements">
                        <p>
                            We may disclose information if required by law, to protect our rights,
                            or to ensure platform safety and security.
                        </p>
                    </Sub>
                    <Sub title="No sale of personal data">
                        <p>
                            We do not sell, rent, or trade your personal information to third parties for marketing purposes.
                        </p>
                    </Sub>
                </Section>

                <Section title="Your rights and choices">
                    <Sub title="Account control">
                        <ul>
                            <li>Update your profile information and display name</li>
                            <li>Control your privacy settings</li>
                            <li>Delete your account and associated data</li>
                            <li>Export your data upon request</li>
                        </ul>
                    </Sub>
                    <Sub title="Content management">
                        <ul>
                            <li>Edit or delete your submitted content</li>
                            <li>Remove your attribution from public displays</li>
                            <li>Opt out of leaderboard participation</li>
                        </ul>
                    </Sub>
                    <Sub title="Communication preferences">
                        <ul>
                            <li>Opt out of promotional emails</li>
                            <li>Control notification settings</li>
                            <li>Manage email frequency preferences</li>
                        </ul>
                    </Sub>
                </Section>

                <Section title="Data security">
                    <p>
                        We implement appropriate security measures to protect your personal information
                        against unauthorized access, alteration, disclosure, or destruction. However,
                        no method of transmission over the internet is 100% secure.
                    </p>
                </Section>

                <Section title="Data retention">
                    <p>
                        We retain your information for as long as your account is active or as needed
                        to provide services. You may request deletion of your data at any time,
                        and we will process your request within 30 days.
                    </p>
                </Section>

                <Section title="Children's privacy">
                    <p>
                        Vexilo is not intended for children under 13. We do not knowingly collect
                        personal information from children under 13. If you believe we have collected
                        such information, please contact us immediately.
                    </p>
                </Section>

                <Section title="Changes to this policy">
                    <p>
                        We may update this privacy policy from time to time. We will notify you of
                        significant changes via email or through the platform. Your continued use of
                        the service after changes constitutes acceptance of the updated policy.
                    </p>
                </Section>

                <Section title="Contact">
                    <p>
                        If you have questions about this privacy policy or our data practices,
                        please contact us at{" "}
                        <a
                            href="mailto:privacy@vexilo.com"
                            className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                        >
                            privacy@vexilo.com
                        </a>
                        .
                    </p>
                </Section>
            </div>
        </article>
    );
}
