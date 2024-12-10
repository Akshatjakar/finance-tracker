import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export default function EmailTemplate({
  userName = "",
  type = "monthly-report",
  data = {},
}) {
  if (type === "monthly-report") {
    return (
      <Html>
        <Head />
        <Preview>Your Monthly Financial Report</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Monthly Financial Report</Heading>

            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              Here&rsquo;s your financial summary for {data?.month}:
            </Text>

            {/* Main Stats */}
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.statLabel}>Total Income</Text>
                <Text style={styles.statValue}>${data?.stats.totalIncome}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.statLabel}>Total Expenses</Text>
                <Text style={styles.statValue}>
                  ${data?.stats.totalExpenses}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.statLabel}>Net</Text>
                <Text style={styles.statValue}>
                  ${data?.stats.totalIncome - data?.stats.totalExpenses}
                </Text>
              </div>
            </Section>

            {/* Category Breakdown */}
            {data?.stats?.byCategory && (
              <Section style={styles.categoryContainer}>
                <Heading as="h2" style={styles.subtitle}>
                  Expenses by Category
                </Heading>
                {Object.entries(data?.stats.byCategory).map(
                  ([category, amount]) => (
                    <div key={category} style={styles.categoryRow}>
                      <Text style={styles.categoryName}>{category}</Text>
                      <Text style={styles.categoryAmount}>${amount}</Text>
                    </div>
                  )
                )}
              </Section>
            )}

            {/* AI Insights */}
            {data?.insights && (
              <Section style={styles.insightsContainer}>
                <Heading as="h2" style={styles.subtitle}>
                  Welth Insights
                </Heading>
                {data.insights.map((insight, index) => (
                  <Text key={index} style={styles.insightText}>
                    • {insight}
                  </Text>
                ))}
              </Section>
            )}

            {/* Footer */}
            <Text style={styles.footer}>
              Thank you for using Welth. Keep tracking your finances for better
              financial health!
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  if (type === "budget-alert") {
    return (
      <Html>
        <Head />
        <Preview>Budget Alert</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Budget Alert</Heading>
            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              You&rsquo;ve used {data?.percentageUsed.toFixed(1)}% of your
              monthly budget.
            </Text>
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.statLabel}>Budget Amount</Text>
                <Text style={styles.statValue}>${data?.budgetAmount}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.statLabel}>Spent So Far</Text>
                <Text style={styles.statValue}>${data?.totalExpenses}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.statLabel}>Remaining</Text>
                <Text style={styles.statValue}>
                  ${data?.budgetAmount - data?.totalExpenses}
                </Text>
              </div>
            </Section>
          </Container>
        </Body>
      </Html>
    );
  }
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "20px",
    marginBottom: "64px",
    borderRadius: "5px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  title: {
    color: "#1f2937",
    fontSize: "32px",
    fontWeight: "bold",
    textAlign: "center",
    margin: "0 0 20px",
  },
  text: {
    color: "#4b5563",
    fontSize: "16px",
    lineHeight: "24px",
    textAlign: "left",
    margin: "0 0 16px",
  },
  statsContainer: {
    margin: "32px 0",
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "5px",
  },
  stat: {
    marginBottom: "16px",
    padding: "12px",
    backgroundColor: "#ffffff",
    borderRadius: "4px",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  statLabel: {
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: "500",
    marginBottom: "4px",
  },
  statValue: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: "bold",
  },
  subtitle: {
    color: "#1f2937",
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "16px",
  },
  categoryContainer: {
    marginTop: "32px",
  },
  categoryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  categoryName: {
    color: "#4b5563",
    fontSize: "16px",
    fontWeight: "500",
  },
  categoryAmount: {
    color: "#1f2937",
    fontSize: "16px",
    fontWeight: "600",
  },
  insightsContainer: {
    marginTop: "32px",
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "5px",
    border: "1px solid #e5e7eb",
  },
  insightText: {
    color: "#4b5563",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "8px 0",
  },
  footer: {
    color: "#6b7280",
    fontSize: "14px",
    textAlign: "center",
    marginTop: "32px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
  },
};
