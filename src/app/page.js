'use client';
import { useState, useEffect } from 'react';

export default function Home() {
	const [orgData, setOrgData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [activeDivision, setActiveDivision] = useState(null);
	const [expandedPrograms, setExpandedPrograms] = useState({});

	useEffect(() => {
		fetch('/api/employees')
			.then(response => response.json())
			.then(data => {
				console.log("data:", data);
				// Remove CIO, DDCIO1, DDCIO2 divisions
				const filteredDivisions = data?.divisions?.filter(
					div =>
						!['CIO', 'DDCIO1', 'DDCIO2'].includes(div.name?.toUpperCase())
				) || [];

				// Add dummy position descriptions for leadership roles
				const enhancedData = {
					...data,
					divisions: filteredDivisions,
					// Add position description to CIO
					cio: data.cio ? {
						...data.cio,
						positionDescription: "Leads the strategic direction and oversight of all information technology operations, ensuring alignment with organizational goals and federal IT requirements."
					} : null,
					// Add position descriptions to Deputy CIOs
					deputyCIOs: data.deputyCIOs?.map((deputy, index) => ({
						...deputy,
						positionDescription: `Supports the CIO in managing IT operations and strategic initiatives. Provides leadership in key technology areas including cybersecurity, data management, and digital transformation.`
					})) || []
				};

				// Add position descriptions to Division Directors
				enhancedData.divisions = filteredDivisions.map(division => ({
					...division,
					director: division.director ? {
						...division.director,
						positionDescription: `Provides executive leadership and strategic direction for the ${division.name} division. Oversees program management, resource allocation, and ensures delivery of mission-critical services.`
					} : null
				}));

				setOrgData(enhancedData);
				setLoading(false);
				if (filteredDivisions.length > 0) {
					setActiveDivision(0);
				}
			})
			.catch(err => {
				setError(err.message);
				setLoading(false);
			});
	}, []);

	const toggleProgram = (divisionIndex, programName) => {
		const key = `${divisionIndex}-${programName}`;
		setExpandedPrograms(prev => ({
			...prev,
			[key]: !prev[key]
		}));
	};

	const getEmploymentStatus = (employee) => {
		const federalCodes = ['GS', 'FED', 'FEDERAL'];
		const status = employee.empl_code || '';
		return federalCodes.some(code => status.toUpperCase().includes(code)) ? 'federal' : 'contractor';
	};

	const EmploymentBadge = ({ employee }) => {
		const status = getEmploymentStatus(employee);
		return (
			<span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
				status === 'federal'
					? 'bg-blue-100 text-blue-800 border border-blue-200'
					: 'bg-orange-100 text-orange-800 border border-orange-200'
			}`}>
				{status === 'federal' ? 'Federal' : 'Contractor'}
			</span>
		);
	};

	const LeadershipCard = ({ person, role, showDescription = true }) => {
		return (
			<div className="bg-white border-l-4 border-[#003185] p-4 rounded-lg shadow-sm">
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<h3 className="text-lg font-semibold text-[#003185]">
							{person.firstName} {person.lastName}
						</h3>
						<p className="text-[#0085ca] font-medium text-sm mb-1">{person.title}</p>
						<p className="text-gray-600 text-sm mb-2">{person.email}</p>
						<div className="mb-2">
							<EmploymentBadge employee={person} />
						</div>
						{showDescription && person.positionDescription && (
							<p className="text-gray-700 text-sm italic mt-2 p-2 bg-gray-50 rounded">
								{person.positionDescription}
							</p>
						)}
					</div>
				</div>
			</div>
		);
	};

	const EmployeeCard = ({ employee, isLead = false }) => {
		return (
			<div className={`bg-white p-3 rounded-lg border shadow-sm ${
				isLead ? 'border-[#0085ca] bg-blue-50' : 'border-gray-200'
			}`}>
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<h4 className={`font-semibold ${isLead ? 'text-[#003185]' : 'text-gray-800'}`}>
							{employee.firstName} {employee.lastName}
						</h4>
						<p className="text-gray-600 text-sm mb-1">{employee.title}</p>
						<p className="text-gray-500 text-xs mb-2">{employee.email}</p>
						<div className="flex items-center gap-2">
							<EmploymentBadge employee={employee} />
							{isLead && (
								<span className="inline-block px-2 py-0.5 text-xs rounded-full font-medium bg-[#0085ca] text-white">
									Program Lead
								</span>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="w-12 h-12 border-4 border-[#003185] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<div className="text-lg text-[#003185]">Loading NMFS OCIO Organization Data...</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center p-6 bg-white rounded-lg shadow-lg">
					<div className="text-red-600 text-lg font-semibold mb-2">Error Loading Data</div>
					<div className="text-gray-600">{error}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
			{/* Header */}
			<div className="bg-[#003185] text-white">
				<div className="max-w-7xl mx-auto px-6 py-8">
					<h1 className="text-3xl font-bold text-center">
						NMFS Office of the Chief Information Officer
					</h1>
					<p className="text-center text-blue-100 mt-2">Organization Directory</p>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-6 py-8">
				{/* CIO Section */}
				{orgData?.cio && (
					<div className="mb-8">
						<h2 className="text-2xl font-bold text-[#003185] mb-4 text-center">Chief Information Officer</h2>
						<div className="max-w-2xl mx-auto mb-6">
							<LeadershipCard person={orgData.cio} role="CIO" />
						</div>
						{/* Deputy CIOs under CIO */}
						{orgData?.deputyCIOs && orgData.deputyCIOs.length > 0 && (
							<div className="mb-4">
								<h3 className="text-lg font-semibold text-[#003185] mb-2 text-center">Deputy Chief Information Officers</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
									{orgData.deputyCIOs.map((deputy, index) => (
										<LeadershipCard key={index} person={deputy} role="Deputy CIO" />
									))}
								</div>
							</div>
						)}
					</div>
				)}

				{/* Divisions Section */}
				{orgData?.divisions && (
					<div>
						<h2 className="text-2xl font-bold text-[#003185] mb-6 text-center">Divisions</h2>

						{/* Division Tabs */}
						<div className="flex flex-wrap justify-center mb-8 border-b border-gray-200">
							{orgData.divisions.map((division, index) => (
								<button
									key={index}
									onClick={() => setActiveDivision(index)}
									className={`px-6 py-3 font-medium text-sm rounded-t-lg mr-1 transition-colors ${
										activeDivision === index
											? 'bg-[#003185] text-white border-b-2 border-[#003185]'
											: 'bg-white text-[#003185] hover:bg-blue-50 border border-gray-200 border-b-0'
									}`}
								>
									{division.name}
								</button>
							))}
						</div>

						{/* Active Division Content */}
						{activeDivision !== null && orgData.divisions[activeDivision] && (
							<div className="bg-white rounded-lg shadow-lg p-6">
								<div className="mb-6">
									<h3 className="text-xl font-bold text-[#003185] mb-4">
										{orgData.divisions[activeDivision].name}
									</h3>

									{/* Division Director */}
									{orgData.divisions[activeDivision].director && (
										<div className="mb-6">
											<h4 className="text-lg font-semibold text-gray-700 mb-3">Division Director</h4>
											<LeadershipCard
												person={orgData.divisions[activeDivision].director}
												role="Director"
											/>
										</div>
									)}

									{/* Programs */}
									{Object.keys(orgData.divisions[activeDivision].programs).length > 0 && (
										<div className="mb-6">
											<h4 className="text-lg font-semibold text-gray-700 mb-4">Programs</h4>
											<div className="space-y-4">
												{Object.values(orgData.divisions[activeDivision].programs).map((program, pIndex) => {
													const isExpanded = expandedPrograms[`${activeDivision}-${program.name}`];
													return (
														<div key={pIndex} className="border border-gray-200 rounded-lg">
															{/* Program Header */}
															<button
																onClick={() => toggleProgram(activeDivision, program.name)}
																className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-t-lg flex items-center justify-between"
															>
																<h5 className="font-semibold text-[#003185]">{program.name}</h5>
																<svg
																	className={`w-5 h-5 transform transition-transform ${
																		isExpanded ? 'rotate-180' : ''
																	}`}
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
																</svg>
															</button>

															{/* Program Content */}
															{isExpanded && (
																<div className="p-4 border-t border-gray-200">
																	{/* Program Lead */}
																	{program.lead && (
																		<div className="mb-4">
																			<h6 className="text-sm font-medium text-gray-600 mb-2">Program Lead</h6>
																			<EmployeeCard employee={program.lead} isLead={true} />
																		</div>
																	)}

																	{/* Program Employees */}
																	{program.employees.length > 0 && (
																		<div>
																			<h6 className="text-sm font-medium text-gray-600 mb-2">Team Members</h6>
																			<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
																				{program.employees.map((employee, eIndex) => (
																					<EmployeeCard key={eIndex} employee={employee} />
																				))}
																			</div>
																		</div>
																	)}
																</div>
															)}
														</div>
													);
												})}
											</div>
										</div>
									)}

									{/* Division-level Employees */}
									{orgData.divisions[activeDivision].employees.length > 0 && (
										<div>
											<h4 className="text-lg font-semibold text-gray-700 mb-4">Division Staff</h4>
											<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
												{orgData.divisions[activeDivision].employees.map((employee, eIndex) => (
													<EmployeeCard key={eIndex} employee={employee} />
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="bg-[#003185] text-white text-center py-4 mt-12">
				<p className="text-sm">
					NOAA | NMFS Office of the Chief Information Officer
				</p>
			</div>
		</div>
	);
}
