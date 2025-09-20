import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Interjar MCP Server",
		version: "1.0.0",
	});

    static env:Env;

    private async makeApiCall(
        endpoint: string,
        method: string = 'GET',
        data?: any,
        headers?: HeadersInit
    ): Promise<any> {
        try {
            const magentoUrl = this.env.API_DOMAIN;
            const bearerToken = this.env.BEARER_TOKEN;
            const userAgent = this.env.USER_AGENT ?? '';

            if (!magentoUrl || !bearerToken) {
                throw new Error('Missing required env vars: API_DOMAIN and BEARER_TOKEN');
            }

            const token = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;

            const apiUrl = `${magentoUrl}/rest/all/V1/${endpoint}`;

            const requestOptions: RequestInit = {
                method,
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': userAgent,
                    ...headers
                }
            };

            if (data && method !== 'GET') {
                requestOptions.body = JSON.stringify(data);
            }

            const response = await fetch(apiUrl, requestOptions);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`API call error: ${error.message}`);
        }
    }

	async init() {

        if (this.env.DATASETS) {

            let datasets = this.env.DATASETS;
            if (typeof datasets === 'string') {
                datasets = JSON.parse(datasets);
            }

            for (const key in datasets)
            {
                const dataset = datasets[key];
                this.server.tool(
                    dataset,
                    {},
                    async({}, { headers }) => {
                        try {
                            const result = await this.makeApiCall(`mcp/dataset/${encodeURIComponent(dataset)}`, 'GET', null, headers);
                            return {
                                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                            };
                        } catch (error) {
                            return {
                                content: [{ type: "text", text: `Error: ${error.message}` }],
                            };
                        }
                    }
                );
            }
        }

        this.server.tool(
            "get_product_by_sku",
            {
                sku: z.string().describe("The SKU of the product to retrieve")
            },
            async ({ sku }, { headers }) => {
                try {
                    const result = await this.makeApiCall(`mcp/product/${encodeURIComponent(sku)}`, 'GET', null, headers);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                } catch (error) {
                    return {
                        content: [{ type: "text", text: `Error: ${error.message}` }],
                    };
                }
            }
        );

        this.server.tool(
            "get_products_by_ids",
            {
                ids: z.string().describe("Comma-separated list of product IDs")
            },
            async ({ ids }, { headers }) => {
                try {
                    const result = await this.makeApiCall(`mcp/products/ids/${encodeURIComponent(ids)}`, 'GET', null, headers);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                } catch (error) {
                    return {
                        content: [{ type: "text", text: `Error: ${error.message}` }],
                    };
                }
            }
        );

        this.server.tool(
            "get_bestsellers",
            {
                date_range: z.string().optional().default('today').describe("Date range: 'today', 'yesterday', 'this week', 'last week', 'this month', 'last month', 'ytd', 'last year', or 'YYYY-MM-DD to YYYY-MM-DD'"),
                limit: z.number().optional().default(10).describe("Number of bestsellers to return"),
                status: z.string().optional().default('').describe("Order status filter (e.g., 'complete', 'processing')")
            },
            async ({ date_range = 'today', limit = 10, status = null }, { headers }) => {
                try {
                    const params = new URLSearchParams({
                        dateRange: date_range,
                        limit: limit.toString()
                    });
                    if (status) {
                        params.append('status', status);
                    }
                    const result = await this.makeApiCall(`mcp/bestsellers?${params}`, 'GET', null, headers);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                } catch (error) {
                    return {
                        content: [{ type: "text", text: `Error: ${error.message}` }],
                    };
                }
            }
        );

        this.server.tool(
            "get_sales_data",
            {
                date_range: z.string().optional().default('today').describe("Date range: 'today', 'yesterday', 'this week', 'last week', 'this month', 'last month', 'ytd', 'last year', or 'YYYY-MM-DD to YYYY-MM-DD'"),
                status: z.string().optional().default('').describe("Order status filter (e.g., 'complete', 'processing')")
            },
            async ({ date_range = 'today', status = null }, { headers }) => {
                try {
                    const params = new URLSearchParams({
                        dateRange: date_range
                    });
                    if (status) {
                        params.append('status', status);
                    }
                    const result = await this.makeApiCall(`mcp/salesData?${params}`, 'GET', null, headers);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                } catch (error) {
                    return {
                        content: [{ type: "text", text: `Error: ${error.message}` }],
                    };
                }
            }
        );
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {

		const url = new URL(request.url);

        if (url.pathname === "/mcp") {
            MyMCP.env = env;
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	}
};
