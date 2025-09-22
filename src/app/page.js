'use client';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import fallbackData from '../data/fallback-employees.json';

export default function Home() {
	const [orgData, setOrgData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [activeDivision, setActiveDivision] = useState(null);
	const [activeDivisions, setActiveDivisions] = useState([]); // For multiple divisions when deputy is clicked
	const [activeDeputy, setActiveDeputy] = useState(null); // Track which deputy is selected

	const organizeEmployeeData = useCallback((employees) => {
		const cio = employees.find(emp =>
			emp.title && emp.title.toLowerCase().includes('chief information officer') &&
			!emp.title.toLowerCase().includes('deputy')
		);

		const deputyCIO = employees.filter(emp =>
			emp.title && emp.title.toLowerCase().includes('deputy cio')
		);

		deputyCIO.forEach(emp => {
			const associatedDivisions = employees
				.filter(e => e.manager && emp.firstName && emp.lastName && e.manager.toLowerCase().includes(`${emp.firstName.toLowerCase()} ${emp.lastName.toLowerCase()}`))
				.map(e => {
					if (e.division && e.division.startsWith('CIO/')) {
						const parts = e.division.split('/');
						return parts.length >= 2 ? parts[1].replace(/\s+$/, '') : 'CIO';
					}
					return e.division;
				})
				.filter((value, index, self) => value && self.indexOf(value) === index); // unique values
			emp.divisionsOwned = associatedDivisions;
		});

		const divisions = {};

		employees.forEach(employee => {
			if (employee.division && employee.division.trim()) {
				let divisionName = employee.division.trim();

				// Extract value after CIO/ and before the second /
				if (divisionName.startsWith('CIO/')) {
					const parts = divisionName.split('/');
					if (parts.length >= 2) {
						divisionName = parts[1].replace(/\s+$/, '');
					} else {
						divisionName = 'CIO';
					}
				}

				if (!divisions[divisionName]) {
					divisions[divisionName] = {
						name: divisionName,
						directors: [],
						programs: {},
						employees: []
					};
				}

				// Check if employee is a director
				if (employee.title && employee.title.toLowerCase().includes('director')) {
					divisions[divisionName].directors.push(employee);
					return; // Don't add directors to regular employee lists
				}

				// If employee has a program, organize by program
				if (employee.program && employee.program.trim()) {
					const programName = employee.program.trim();

					if (!divisions[divisionName].programs[programName]) {
						divisions[divisionName].programs[programName] = {
							name: programName,
							employees: []
						};
					}

					divisions[divisionName].programs[programName].employees.push(employee);
				} else {
					// Employee belongs directly to division (no program)
					divisions[divisionName].employees.push(employee);
				}
			}
		});

		// Sort employees within each program and division (managers first)
		Object.values(divisions).forEach(division => {
			division.employees.sort((a, b) => {
				const aIsManager = isManager(a);
				const bIsManager = isManager(b);

				// Managers always on top
				if (aIsManager && !bIsManager) return -1;
				if (!aIsManager && bIsManager) return 1;

				// Both are managers or both are not managers
				const aStatus = getEmploymentStatus(a);
				const bStatus = getEmploymentStatus(b);

				// Federal before contractor
				if (aStatus !== bStatus) {
					return aStatus === 'federal' ? -1 : 1;
				}

				// Alphabetical by first name within status
				return a.firstName.localeCompare(b.firstName);
			});

			Object.values(division.programs).forEach(program => {
				program.employees.sort((a, b) => {
					const aIsManager = isManager(a);
					const bIsManager = isManager(b);

					// Managers always on top
					if (aIsManager && !bIsManager) return -1;
					if (!aIsManager && bIsManager) return 1;

					// Both are managers or both are not managers
					const aStatus = getEmploymentStatus(a);
					const bStatus = getEmploymentStatus(b);

					// Federal before contractor
					if (aStatus !== bStatus) {
						return aStatus === 'federal' ? -1 : 1;
					}

					// Alphabetical by first name within status
					return a.firstName.localeCompare(b.firstName);
				});
			});
		});

		console.log("employees:", employees);

		return {
			cio,
			deputyCIO,
			divisions: Object.values(divisions)
		};
	}, []);

	const fetchEmployeeData = useCallback(async () => {
		try {
			// Environment detection
			const isGAS = typeof google !== 'undefined' && google.script;
			const isLocalDev = process.env.NODE_ENV === 'development';

			if (isGAS) {
				// Running in Google Apps Script environment
				console.log('Fetching data from Google Apps Script backend...');
				return new Promise((resolve, reject) => {
					google.script.run
						.withSuccessHandler(function(employees) {
							console.log(`Successfully loaded ${employees?.length || 0} employees from GAS backend`);
							if (!employees || !Array.isArray(employees) || employees.length === 0) {
								console.warn('No employee data received from GAS, using fallback data');
								resolve(fallbackData);
							} else {
								resolve(employees);
							}
						})
						.withFailureHandler(function(error) {
							console.error('Error fetching employee data from GAS:', error);
							console.warn('Falling back to local data');
							resolve(fallbackData);
						})
						.getEmployeeData();
				});
			} else {
				// Running in Next.js environment (local dev or production)
				console.log('Fetching data from Next.js API...');
				console.log('Environment: ', {
					NODE_ENV: process.env.NODE_ENV,
					isLocalDev,
					isGAS: false
				});

				const response = await axios.get('/api/employees', {
					timeout: 10000, // 10 second timeout
				});

				console.log("response: ", response);

				const employees = response.data;

				if (!employees || !Array.isArray(employees) || employees.length === 0) {
					console.warn('No employee data received from API, using fallback data');
					return fallbackData;
				}

				console.log(`Successfully loaded ${employees.length} employees from Next.js API`);
				return employees;
			}
		} catch (error) {
			console.error('Error fetching employee data:', error);
			console.warn('Falling back to local data');
			return fallbackData;
		}
	}, []);

	useEffect(() => {
		const loadData = async () => {
			try {
				const employees = await fetchEmployeeData();
				const organizedData = organizeEmployeeData(employees);

				const filteredDivisions = organizedData?.divisions?.filter(
					div =>
						!['CIO', 'DDCIO1', 'DDCIO2'].includes(div.name?.toUpperCase())
				) || [];

				setOrgData({
					cio: organizedData.cio,
					deputyCIO: organizedData.deputyCIO,
					divisions: filteredDivisions
				});

				setLoading(false);
				if (filteredDivisions.length > 0) {
					setActiveDivision(0);
					setActiveDivisions([]); // Reset multiple divisions when data loads
					setActiveDeputy(null); // Reset active deputy when data loads
				}
			} catch (err) {
				setError(err.message);
				setLoading(false);
			}
		};

		loadData();
	}, [fetchEmployeeData, organizeEmployeeData]);

	const getEmploymentStatus = (employee) => {
		const federalCodes = ['GS', 'FED', 'FEDERAL'];
		const status = employee.empl_code || '';
		return federalCodes.some(code => status.toUpperCase().includes(code)) ? 'federal' : 'contractor';
	};

	const isManager = (employee) => {
		return employee.title && (
			employee.title.toLowerCase().includes('director') ||
			employee.title.toLowerCase().includes('manager') ||
			employee.title.toLowerCase().includes('lead') ||
			employee.title.toLowerCase().includes('chief') ||
			employee.title.toLowerCase().includes('deputy') ||
			employee.title.toLowerCase().includes('supervisory it specialist')
		);
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{backgroundColor: 'var(--background)'}}>
				<div className="text-center">
					<div className="w-12 h-12 mx-auto mb-4 relative">
						<div className="absolute inset-0 rounded-full border-4 border-[var(--foreground)] opacity-20"></div>
						<div className="absolute inset-0 rounded-full border-4 border-t-transparent border-[var(--foreground)] animate-spin"></div>
					</div>
					<div className="text-lg" style={{color: 'var(--foreground)'}}>Loading OCIO Organization Data...</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{backgroundColor: 'var(--background)'}}>
				<div className="text-center p-6 bg-white rounded-lg shadow-lg">
					<div className="text-red-600 text-lg font-semibold mb-2">Error Loading Data</div>
					<div style={{color: 'var(--foreground)'}}>{error}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col" style={{backgroundColor: 'var(--background)'}}>
			{/* Header */}
			<div className="text-white" style={{backgroundColor: 'var(--primary-dark)'}}>
				<div className="max-w-6xl mx-auto px-6 py-8">
					<h1 className="text-3xl font-bold text-center">
						NOAA Office of the Chief Information Officer
					</h1>
					<p className="text-center mt-2" style={{color: 'var(--secondary)'}}>Organization Directory</p>
				</div>
			</div>

			<div className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full">
				{/* CIO Section */}
			<div className="mb-8 flex flex-col items-center">
				<div className="text-lg font-medium mb-2 text-center" style={{color: 'var(--primary-dark)'}}>Chief Information Officer</div>
				<div className="text-xl font-semibold mb-4 text-center" style={{color: 'var(--foreground)'}}>
					{orgData?.cio ?
						`${orgData.cio.firstName} ${orgData.cio.lastName}` :
						'Chief Information Officer Name'
					}
				</div>
				<div className="border-b border-[var(--border)] w-full"></div>
			</div>

			{/* Deputy CIO Section */}
				<div className="mb-8 flex flex-col items-center">
					<div className="flex flex-wrap justify-center gap-10 text-lg font-semibold text-[var(--foreground)] mb-4">
						{orgData?.deputyCIO && orgData.deputyCIO.length > 0 ?
							orgData.deputyCIO.map((dep, idx) => {
								const divisionIndex = orgData.divisions.findIndex(
									div => div.name?.toLowerCase() === dep.division?.trim().toLowerCase()
								);

								// Check if active division is in this deputy's divisionsOwned
								const isOwner = dep.divisionsOwned?.some(
									owned => owned?.toLowerCase() === orgData.divisions[activeDivision]?.name?.toLowerCase()
								);

								return (
									<button
										key={idx}
										type="button"
										className={`hover:none focus:outline-none px-2 py-1 rounded cursor-pointer border-2 ${
											activeDeputy === idx
												? 'border-[var(--primary)] bg-[var(--light-accent)] text-[var(--foreground)]'
												: 'border-transparent bg-transparent text-[var(--foreground)]'
										} ${isOwner ? 'border-[var(--foreground)] bg-[var(--secondary)] text-[var(--foreground)]' : ''}`}
										onClick={() => {
											setActiveDeputy(idx);

											// Handle deputy CIO click - activate all their owned divisions
											if (dep.divisionsOwned && dep.divisionsOwned.length > 0) {
												const divisionIndices = dep.divisionsOwned
													.map(divName => orgData.divisions.findIndex(div => div.name?.toLowerCase() === divName?.toLowerCase()))
													.filter(index => index !== -1);

												setActiveDivisions(divisionIndices);
												setActiveDivision(null); // Clear single division when multiple are active
											} else if (divisionIndex !== -1) {
												// Fallback to single division if no owned divisions
												setActiveDivision(divisionIndex);
												setActiveDivisions([]);
											}
										}}
									>
										{dep.firstName} {dep.lastName}
									</button>
								);
							})
							:
							<span>Deputy CIO Name</span>
						}
					</div>
					<div className="border-b border-[var(--border)] w-full"></div>
				</div>

				{/* Division Tabs */}
				{orgData?.divisions && (
					<div>
						<div className="flex flex-wrap gap-2 mb-8 justify-center">
							{orgData.divisions.map((division, index) => (
								<button
									key={index}
									onClick={() => {
										// Handle individual division click - clear multiple divisions and set single
										setActiveDivision(index);
										setActiveDivisions([]);
										setActiveDeputy(null); // Clear active deputy when individual division is selected
									}}
									className={`px-4 py-2 text-sm font-medium rounded cursor-pointer ${
										activeDivision === index || activeDivisions.includes(index)
											? 'bg-[var(--primary)] text-white'
											: 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--primary-dark)] hover:text-white'
									}`}
								>
									{division.name}
								</button>
							))}
						</div>

						{/* Active Division Content */}
						{/* Single division active */}
						{activeDivision !== null && activeDivisions.length === 0 && orgData.divisions[activeDivision] && (
							<div>
								{/* Division Title */}
								<h2 className="text-xl font-bold text-[var(--foreground)] mb-6">
									{orgData.divisions[activeDivision].name}
								</h2>

								{orgData.divisions[activeDivision].directors.length > 0 && (
									<div className="mb-6">
										{orgData.divisions[activeDivision].directors.map((director, dIndex) => (
											<div key={dIndex} className="flex items-center gap-2 mb-2">
												<span className="font-medium text-[var(--foreground)]">
													{director.firstName} {director.lastName}
												</span>
												<span className="px-2 py-1 text-xs bg-[var(--secondary)] text-[var(--foreground)] rounded">
													Director
												</span>
											</div>
										))}
										<div className="border-b border-[var(--border)] mt-4"></div>
									</div>
								)}

								{/* Programs - horizontal layout */}
								{Object.keys(orgData.divisions[activeDivision].programs).length > 0 && (
									<div className="flex flex-wrap gap-6 mb-6">
										{Object.values(orgData.divisions[activeDivision].programs).map((program, pIndex) => (
											<div key={pIndex} className="min-w-[220px] bg-white rounded-lg shadow-sm p-4 flex-1">
												<h3 className="text-base font-medium text-[var(--foreground)] mb-3 text-center">
													{program.name}
												</h3>
												<div className="space-y-1">
													{program.employees.map((employee, eIndex) => {
														const employmentStatus = getEmploymentStatus(employee);
														const employeeIsManager = isManager(employee);

														return (
															<div
																key={eIndex}
																className={`flex items-center gap-2 ${
																	employeeIsManager ? "" : "pl-6"
																}`}
															>
																<span
																	className={`text-sm text-[var(--foreground)] ${
																		employeeIsManager ? "font-bold" : ""
																	}`}
																>
																	{employee.firstName} {employee.lastName}
																</span>
																{employeeIsManager && (
																	<span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--foreground)] rounded">
																		Manager
																	</span>
																)}
																{employmentStatus === 'federal' && (
																	<span className="px-2 py-1 text-xs bg-[var(--light-accent)] text-[var(--foreground)] rounded">
																		Federal
																	</span>
																)}
															</div>
														);
													})}
												</div>
											</div>
										))}
									</div>
								)}

								{/* Division Staff (no program) */}
								{orgData.divisions[activeDivision].employees.length > 0 && (
									<div className={Object.keys(orgData.divisions[activeDivision].programs).length > 0 ? "mt-6 pt-6 border-t border-[var(--border)]" : ""}>
										<h3 className="text-base font-medium text-[var(--foreground)] mb-3">
											UNSPECIFIED PROGRAM
										</h3>
										<div className="space-y-1 pl-4">
											{orgData.divisions[activeDivision].employees.map((employee, eIndex) => {
												const employmentStatus = getEmploymentStatus(employee);
												const employeeIsManager = isManager(employee);

												return (
													<div key={eIndex} className="flex items-center gap-2">
														<span className="text-sm text-[var(--foreground)]">
															{employee.firstName} {employee.lastName}
														</span>
														{employeeIsManager && (
															<span className="px-2 py-1 text-xs bg-[var(--primary-dark)] text-white rounded">
																Manager
															</span>
														)}
														{employmentStatus === 'federal' && (
															<span className="px-2 py-1 text-xs bg-[var(--primary-dark)] text-white rounded">
																Federal
															</span>
														)}
													</div>
												);
											})}
										</div>
									</div>
								)}
							</div>
						)}

						{/* Multiple divisions active (when deputy CIO is clicked) */}
						{activeDivisions.length > 0 && (
							<div className="space-y-8">
								{activeDivisions.map((divisionIndex) => {
									const division = orgData.divisions[divisionIndex];
									if (!division) return null;

									return (
										<div key={divisionIndex} className="border-b border-[var(--border)] last:border-b-0 pb-6 last:pb-0">
											{/* Division Title */}
											<h2 className="text-xl font-bold text-[var(--foreground)] mb-6">
												{division.name}
											</h2>

											{division.directors.length > 0 && (
												<div className="mb-6">
													{division.directors.map((director, dIndex) => (
														<div key={dIndex} className="flex items-center gap-2 mb-2">
															<span className="font-medium text-[var(--foreground)]">
																{director.firstName} {director.lastName}
															</span>
															<span className="px-2 py-1 text-xs bg-[var(--secondary)] text-[var(--foreground)] rounded">
																Director
															</span>
														</div>
													))}
													<div className="border-b border-[var(--border)] mt-4"></div>
												</div>
											)}

											{/* Programs - horizontal layout */}
											{Object.keys(division.programs).length > 0 && (
												<div className="flex flex-wrap gap-6 mb-6">
													{Object.values(division.programs).map((program, pIndex) => (
														<div key={pIndex} className="min-w-[220px] bg-white rounded-lg shadow-sm p-4 flex-1">
															<h3 className="text-base font-medium text-[var(--foreground)] mb-3 text-center">
																{program.name}
															</h3>
															<div className="space-y-1">
																{program.employees.map((employee, eIndex) => {
																	const employmentStatus = getEmploymentStatus(employee);
																	const employeeIsManager = isManager(employee);

																	return (
																		<div
																			key={eIndex}
																			className={`flex items-center gap-2 ${
																				employeeIsManager ? "" : "pl-6"
																			}`}
																		>
																			<span
																				className={`text-sm text-[var(--foreground)] ${
																					employeeIsManager ? "font-bold" : ""
																				}`}
																			>
																				{employee.firstName} {employee.lastName}
																			</span>
																			{employeeIsManager && (
																				<span className="px-2 py-1 text-xs bg-[var(--secondary)] text-[var(--foreground)] rounded">
																					Manager
																				</span>
																			)}
																			{employmentStatus === 'federal' && (
																				<span className="px-2 py-1 text-xs bg-[var(--secondary)] text-[var(--foreground)] rounded">
																					Federal
																				</span>
																			)}
																		</div>
																	);
																})}
															</div>
														</div>
													))}
												</div>
											)}

											{/* Division Staff (no program) */}
											{division.employees.length > 0 && (
												<div className={Object.keys(division.programs).length > 0 ? "mt-6 pt-6 border-t border-[var(--border)]" : ""}>
													<h3 className="text-base font-medium text-[var(--foreground)] mb-3">
														UNSPECIFIED PROGRAM
													</h3>
													<div className="space-y-1 pl-4">
														{division.employees.map((employee, eIndex) => {
															const employmentStatus = getEmploymentStatus(employee);
															const employeeIsManager = isManager(employee);

															return (
																<div key={eIndex} className="flex items-center gap-2">
																	<span className="text-sm text-[var(--foreground)]">
																		{employee.firstName} {employee.lastName}
																	</span>
																	{employeeIsManager && (
																		<span className="px-2 py-1 text-xs bg-[var(--secondary)] text-[var(--foreground)] rounded">
																			Manager
																		</span>
																	)}
																	{employmentStatus === 'federal' && (
																		<span className="px-2 py-1 text-xs bg-[var(--primary-dark)] text-white rounded">
																			federal
																	</span>
																	)}
																</div>
															);
														})}
													</div>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Footer */}
			<footer className="bg-[var(--primary)] text-white text-center py-4 w-full mt-auto">
				<p className="text-sm">
					NOAA | Office of the Chief Information Officer
				</p>
			</footer>
		</div>
	);
}