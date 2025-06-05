import React from "react"
import { render, fireEvent, waitFor, screen } from "@testing-library/react"
import '@testing-library/jest-dom'
import { OrdersTable } from "./orders-table"

// Mock Papa.parse for CSV parsing
jest.mock("papaparse", () => ({
  __esModule: true,
  default: {
    parse: (file: File, opts: any) => {
      // Simulate a simple CSV parse for test
      const text = (file as any).textSync?.() || ""
      if (text.includes("INVALID")) {
        opts.error({ message: "Invalid CSV" })
      } else {
        opts.complete({ data: [
          { order_number: "ORD001", stock_code: "STK1", description: "Test Order", quantity_to_make: "10" },
          { order_number: "ORD002", stock_code: "STK2", description: "Another Order", quantity_to_make: "5" }
        ] })
      }
    }
  }
}))

describe("OrdersTable CSV Import", () => {
  const orders: any[] = []

  it("renders Import CSV button and dialog", () => {
    render(<OrdersTable orders={orders} />)
    expect(screen.getByText("Import CSV")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Import CSV"))
    expect(screen.getByText("Import Orders from CSV")).toBeInTheDocument()
  })

  it("shows error for invalid CSV", async () => {
    render(<OrdersTable orders={orders} />)
    fireEvent.click(screen.getByText("Import CSV"))
    const file = new File(["INVALID"], "invalid.csv", { type: "text/csv" })
    Object.defineProperty(file, 'textSync', { value: () => "INVALID" })
    const input = screen.getByLabelText(/import/i) || screen.getByRole('textbox') || screen.getByRole('input') || screen.getByRole('file') || screen.getByDisplayValue('')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/Failed to parse CSV/i)).toBeInTheDocument())
  })

  it("imports valid CSV and shows success", async () => {
    render(<OrdersTable orders={orders} />)
    fireEvent.click(screen.getByText("Import CSV"))
    const file = new File(["order_number,stock_code,description,quantity_to_make\nORD001,STK1,Test Order,10"], "orders.csv", { type: "text/csv" })
    Object.defineProperty(file, 'textSync', { value: () => "order_number,stock_code,description,quantity_to_make\nORD001,STK1,Test Order,10" })
    const input = screen.getByLabelText(/import/i) || screen.getByRole('textbox') || screen.getByRole('input') || screen.getByRole('file') || screen.getByDisplayValue('')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/Imported 2 orders successfully/i)).toBeInTheDocument())
  })

  it("shows error for missing required fields", async () => {
    // Patch the mock to return a row missing required fields
    const mockPapaparse = jest.requireMock("papaparse").default
    mockPapaparse.parse = (file: File, opts: any) => {
      opts.complete({ data: [ { stock_code: "STK1" } ] })
    }
    render(<OrdersTable orders={orders} />)
    fireEvent.click(screen.getByText("Import CSV"))
    const file = new File(["stock_code\nSTK1"], "missing.csv", { type: "text/csv" })
    Object.defineProperty(file, 'textSync', { value: () => "stock_code\nSTK1" })
    const input = screen.getByLabelText(/import/i) || screen.getByRole('textbox') || screen.getByRole('input') || screen.getByRole('file') || screen.getByDisplayValue('')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/Missing required fields/i)).toBeInTheDocument())
  })
}) 