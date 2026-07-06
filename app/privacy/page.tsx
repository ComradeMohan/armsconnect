import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="legal-wrapper">
      <div className="legal-container">
        <div className="legal-card">
          <div className="legal-header">
            <Link href="/" className="back-link">
              <i className="fas fa-arrow-left"></i>
              <span>Back to Home</span>
            </Link>
            <h1>Privacy Policy</h1>
            <p className="last-updated">Last Updated: January 2025</p>
          </div>

          <div className="legal-content">
            <section>
              <h2>1. Information We Collect</h2>
              <p>
                ARMSConnect only collects the information necessary to provide you with access to your academic data. 
                This includes:
              </p>
              <ul>
                <li>Your registration number and password (used solely for authentication with the official portal)</li>
                <li>Academic information retrieved from the official portal (attendance, grades, profile details)</li>
              </ul>
            </section>

            <section>
              <h2>2. How We Use Your Information</h2>
              <p>
                Your information is used exclusively to:
              </p>
              <ul>
                <li>Authenticate your credentials with the official ARMS portal</li>
                <li>Retrieve and display your academic information</li>
                <li>Provide a convenient interface for viewing your data</li>
                <li>Generate analytics and visualizations of your academic performance</li>
              </ul>
            </section>

            <section>
              <h2>3. Data Storage</h2>
              <p>
                <strong>No Permanent Data Storage:</strong> ARMSConnect does not permanently store your personal academic 
                data on our servers. All information is retrieved in real-time from the official college portal when you 
                log in and is displayed directly to you.
              </p>
              <p>
                <strong>Temporary Storage:</strong> Your session data may be temporarily stored in your browser's local 
                storage or session storage for the duration of your session to maintain your login state and improve 
                user experience. This data is cleared when you log out or your session expires.
              </p>
              <p>
                <strong>Server Logs:</strong> Temporary server logs may be maintained for debugging, security monitoring, 
                and service improvement purposes. These logs do not contain sensitive personal information like passwords 
                or detailed academic records.
              </p>
            </section>

            <section>
              <h2>4. Data Sharing</h2>
              <p>
                <strong>We do not share your personal data with any third parties.</strong> Your information is never sold, 
                rented, or shared with external services for marketing or any other commercial purposes.
              </p>
              <p>
                Your credentials are used only to authenticate with the official ARMS portal and are not transmitted to 
                any other services.
              </p>
            </section>

            <section>
              <h2>5. Security</h2>
              <p>
                We implement reasonable security measures to protect your information during transmission and while 
                temporarily stored. However, no method of transmission over the internet is completely secure. We 
                encourage you to:
              </p>
              <ul>
                <li>Use strong, unique passwords</li>
                <li>Not share your credentials with anyone</li>
                <li>Log out after each session, especially on shared devices</li>
                <li>Keep your browser and device updated with security patches</li>
              </ul>
            </section>

            <section>
              <h2>6. Your Rights</h2>
              <p>
                You have the right to:
              </p>
              <ul>
                <li>Access your academic information through this application</li>
                <li>Clear your browser's stored data at any time</li>
                <li>Opt out of "Keep me logged in" feature</li>
                <li>Request deletion of any temporary data stored on our servers</li>
              </ul>
            </section>

            <section>
              <h2>7. Cookies and Local Storage</h2>
              <p>
                This application uses browser local storage and session storage to enhance your experience by maintaining 
                your login session and preferences. You can control or delete this data through your browser settings.
              </p>
            </section>

            <section>
              <h2>8. Children's Privacy</h2>
              <p>
                This application is not intended for children under the age of 13. We do not knowingly collect personal 
                information from children under 13.
              </p>
            </section>

            <section>
              <h2>9. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify users of any significant changes by 
                updating the "Last Updated" date and displaying a notice within the application.
              </p>
            </section>

            <section>
              <h2>10. Official Records</h2>
              <p>
                For official academic records, verification, or any discrepancies, always refer to the original ARMS 
                portal or contact the college administration directly. This application serves as a convenient viewing 
                interface only.
              </p>
            </section>

            <section>
              <h2>11. Contact Us</h2>
              <p>
                If you have questions about this privacy policy or how we handle your data, please contact us through 
                the appropriate channels provided in the application.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
